const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const BaseProvider = require('./BaseProvider');
const { solveBase64 } = require('../utils/svgCaptchaSolver');

const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRandomKey(prefix = 'BYPASS') {
  let out = `${prefix.trim().toUpperCase()}-`;
  for (let i = 0; i < 12; i++) {
    const rand = Math.floor(Math.random() * KEY_CHARS.length);
    out += KEY_CHARS.charAt(rand);
    if (i % 4 === 3 && i < 11) out += '-';
  }
  return out;
}

class BypassProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.resetSession();
  }

  resetSession() {
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        baseURL: this.config.baseUrl,
        jar: this.jar,
        withCredentials: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json, text/plain, */*',
        },
        timeout: 15000,
      })
    );
    this.authenticated = false;
  }

  /**
   * Obtener y resolver captcha para login o create
   */
  async getCaptcha(purpose = 'login', maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await this.client.post(`/api/captcha/${purpose}`);
        if (!res.data || !res.data.image) {
          throw new Error('Respuesta de captcha sin imagen');
        }
        const answer = solveBase64(res.data.image);
        if (answer) {
          return { id: res.data.id, answer };
        }
      } catch (err) {
        if (attempt === maxAttempts) {
          throw new Error(`[Bypass Web] No se pudo obtener/resolver captcha (${purpose}): ${err.message}`);
        }
      }
    }
    throw new Error(`[Bypass Web] Fallo al resolver captcha (${purpose}) tras ${maxAttempts} intentos.`);
  }

  async login(retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const captcha = await this.getCaptcha('login');
        const res = await this.client.post('/api/auth/login', {
          username: this.config.username,
          password: this.config.password,
          captcha_id: captcha.id,
          captcha_answer: captcha.answer,
        });

        if (res.data && res.data.success) {
          this.authenticated = true;
          return true;
        }
        throw new Error(res.data?.message || 'Login falló en Bypass Web');
      } catch (err) {
        this.authenticated = false;
        const msg = err.response?.data?.message || err.message;
        if (i < retries - 1) {
          console.warn(`[Bypass Web] Intento de login ${i + 1} falló (${msg}), limpiando sesión y reintentando...`);
          this.resetSession();
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw new Error(`[Bypass Web] Error de autenticación: ${msg}`);
      }
    }
  }

  async ensureAuth() {
    if (!this.authenticated) {
      await this.login();
    }
  }

  async checkHealth() {
    const start = Date.now();
    try {
      await this.ensureAuth();
      const testRes = await this.client.get('/api/licenses');
      if (testRes.status === 401) {
        console.warn(`[Bypass Web] checkHealth detectó sesión expirada. Renovando...`);
        this.resetSession();
        await this.login();
      }
      const latency = Date.now() - start;
      return { online: true, latency, message: 'Sesión activa y panel operativo' };
    } catch (err) {
      if (err.response?.status === 401) {
        try {
          this.resetSession();
          await this.login();
          return { online: true, latency: Date.now() - start, message: 'Sesión renovada exitosamente' };
        } catch (loginErr) {
          return { online: false, latency: Date.now() - start, error: loginErr.message };
        }
      }
      return { online: false, latency: Date.now() - start, error: err.message };
    }
  }

  /**
   * Crear una key individual con captcha
   * Si customKey es null/vacío, se omite license_key para que el servidor
   * de Bypass Web genere su formato nativo por defecto exactamente como la página web.
   */
  async createSingleKey(days, note = '', customKey = null, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const captcha = await this.getCaptcha('create');
        const payload = {
          duration_days: Number(days),
          note: note ? note.trim() : '',
          captcha_id: captcha.id,
          captcha_answer: captcha.answer,
        };
        if (customKey && String(customKey).trim()) {
          payload.license_key = String(customKey).trim();
        }

        const res = await this.client.post('/api/licenses/create', payload);

        if (res.data && res.data.license_key) {
          return res.data.license_key;
        }
        if (res.data && res.data.license?.license_key) {
          return res.data.license.license_key;
        }
        return customKey || 'KEY_CREATED';
      } catch (err) {
        if (err.response?.status === 401) {
          console.warn(`[Bypass Web] ⚠️ Sesión caducada al crear clave. Reseteando sesión y reintentando...`);
          this.resetSession();
          await this.login();
          return this.createSingleKey(days, note, customKey, retries - 1);
        }
        const msg = err.response?.data?.message || err.message;
        if (attempt < retries && String(msg).toLowerCase().includes('captcha')) {
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Generar keys en Bypass Web
   */
  async createKey({ days, count = 1, prefix = '', note = '' }) {
    await this.ensureAuth();
    const createdKeys = [];
    const isCustom = prefix && prefix.trim() && prefix.trim().toUpperCase() !== 'BYPASS';

    try {
      for (let i = 0; i < count; i++) {
        const customKey = isCustom ? generateRandomKey(prefix.trim().toUpperCase()) : null;
        const finalKey = await this.createSingleKey(days, note, customKey);
        createdKeys.push(finalKey);
      }

      return createdKeys;
    } catch (err) {
      if (err.response?.status === 401) {
        this.resetSession();
        await this.login();
        return this.createKey({ days, count, prefix, note });
      }
      const msg = err.response?.data?.message || err.message;
      throw new Error(`[Bypass Web] Error al crear licencia: ${msg}`);
    }
  }

  /**
   * Eliminar licencia
   */
  async deleteKey(key) {
    await this.ensureAuth();
    try {
      const res = await this.client.post('/api/licenses/delete', {
        license_key: key.trim(),
      });
      return res.data?.message || 'Licencia eliminada correctamente.';
    } catch (err) {
      if (err.response?.status === 401) {
        this.resetSession();
        await this.login();
        return this.deleteKey(key);
      }
      const msg = err.response?.data?.message || err.message;
      throw new Error(`[Bypass Web] Error al eliminar: ${msg}`);
    }
  }

  /**
   * Resetear HWID
   */
  async resetHwid(key) {
    await this.ensureAuth();
    try {
      const res = await this.client.post('/api/licenses/reset-hwid', {
        license_key: key.trim(),
      });
      return res.data?.message || 'HWID reseteado correctamente.';
    } catch (err) {
      if (err.response?.status === 401) {
        this.resetSession();
        await this.login();
        return this.resetHwid(key);
      }
      const msg = err.response?.data?.message || err.message;
      throw new Error(`[Bypass Web] Error al resetear HWID: ${msg}`);
    }
  }

  /**
   * Listar licencias
   */
  async listKeys() {
    await this.ensureAuth();
    try {
      const res = await this.client.get('/api/licenses');
      return res.data?.licenses || [];
    } catch (err) {
      if (err.response?.status === 401) {
        this.resetSession();
        await this.login();
        return this.listKeys();
      }
      return [];
    }
  }
}

module.exports = BypassProvider;
