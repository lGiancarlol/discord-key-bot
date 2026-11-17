const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const BaseProvider = require('./BaseProvider');
const { solveBase64 } = require('../utils/svgCaptchaSolver');

const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRandomKey(prefix = 'UID') {
  let out = `${prefix.trim().toUpperCase()}-`;
  for (let i = 0; i < 12; i++) {
    const rand = Math.floor(Math.random() * KEY_CHARS.length);
    out += KEY_CHARS.charAt(rand);
    if (i % 4 === 3 && i < 11) out += '-';
  }
  return out;
}

class BypassUidProvider extends BaseProvider {
  constructor(config) {
    super(config);
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
          throw new Error(`[Bypass UID] No se pudo obtener/resolver captcha (${purpose}): ${err.message}`);
        }
      }
    }
    throw new Error(`[Bypass UID] Fallo al resolver captcha (${purpose}) tras ${maxAttempts} intentos.`);
  }

  async login(retries = 2) {
    for (let i = 0; i <= retries; i++) {
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
        if (i < retries && String(msg).toLowerCase().includes('captcha')) {
          continue;
        }
        throw new Error(`[Bypass UID] Error de autenticación: ${msg}`);
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
      const latency = Date.now() - start;
      return { online: true, latency, message: 'Sesión activa y panel operativo' };
    } catch (err) {
      return { online: false, latency: Date.now() - start, error: err.message };
    }
  }

  /**
   * Crear una key individual con UID activado
   */
  async createSingleKey(customKey, days, note = '', retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const captcha = await this.getCaptcha('create');
        const res = await this.client.post('/api/uid/licenses/create', {
          license_key: customKey,
          duration_days: Number(days),
          note: note ? note.trim() : '',
          captcha_id: captcha.id,
          captcha_answer: captcha.answer,
        });

        if (res.data && res.data.license) {
          return res.data.license.license_key || customKey;
        }
        if (res.data && res.data.license_key) {
          return res.data.license_key;
        }
        return customKey;
      } catch (err) {
        if (err.response?.status === 401) {
          this.authenticated = false;
          await this.login();
          return this.createSingleKey(customKey, days, note, retries - 1);
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
   * Generar licencia y activar UID ON automáticamente
   */
  async createKey({ days, count = 1, prefix = 'UID', note = '' }) {
    await this.ensureAuth();
    const createdKeys = [];
    const targetPrefix = prefix ? prefix.trim().toUpperCase() : 'UID';

    try {
      for (let i = 0; i < count; i++) {
        const customKey = generateRandomKey(targetPrefix);
        const finalKey = await this.createSingleKey(customKey, days, note);
        createdKeys.push(finalKey);
      }

      return createdKeys;
    } catch (err) {
      if (err.response?.status === 401) {
        this.authenticated = false;
        await this.login();
        return this.createKey({ days, count, prefix, note });
      }
      const msg = err.response?.data?.message || err.message;
      throw new Error(`[Bypass UID] Error al crear licencia UID: ${msg}`);
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
      return res.data?.message || 'HWID reseteado correctamente en Bypass UID.';
    } catch (err) {
      if (err.response?.status === 401) {
        this.authenticated = false;
        await this.login();
        return this.resetHwid(key);
      }
      const msg = err.response?.data?.message || err.message;
      throw new Error(`[Bypass UID] Error al resetear HWID: ${msg}`);
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
      return res.data?.message || 'Licencia eliminada correctamente en Bypass UID.';
    } catch (err) {
      if (err.response?.status === 401) {
        this.authenticated = false;
        await this.login();
        return this.deleteKey(key);
      }
      const msg = err.response?.data?.message || err.message;
      throw new Error(`[Bypass UID] Error al eliminar: ${msg}`);
    }
  }

  /**
   * Listar licencias con UID
   */
  async listKeys() {
    await this.ensureAuth();
    try {
      const res = await this.client.get('/api/uid/licenses');
      return res.data?.licenses || [];
    } catch (err) {
      if (err.response?.status === 401) {
        this.authenticated = false;
        await this.login();
        return this.listKeys();
      }
      return [];
    }
  }
}

module.exports = BypassUidProvider;
