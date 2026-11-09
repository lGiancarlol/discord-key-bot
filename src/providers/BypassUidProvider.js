const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const BaseProvider = require('./BaseProvider');

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

  async login() {
    try {
      const res = await this.client.post('/api/auth/login', {
        username: this.config.username,
        password: this.config.password,
      });

      if (res.data && res.data.success) {
        this.authenticated = true;
        return true;
      }
      throw new Error(res.data?.message || 'Login falló en Bypass Web');
    } catch (err) {
      this.authenticated = false;
      const msg = err.response?.data?.message || err.message;
      throw new Error(`[Bypass UID] Error de autenticación: ${msg}`);
    }
  }

  async ensureAuth() {
    if (!this.authenticated) {
      await this.login();
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
        const res = await this.client.post('/api/uid/licenses/create', {
          license_key: customKey,
          duration_days: Number(days),
          note: note.trim(),
        });

        if (res.data && res.data.license) {
          createdKeys.push(res.data.license.license_key || customKey);
        } else {
          createdKeys.push(customKey);
        }
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
    } catch {
      return [];
    }
  }
}

module.exports = BypassUidProvider;
