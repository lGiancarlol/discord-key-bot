const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const BaseProvider = require('./BaseProvider');

class MyCheatsProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        baseURL: this.config.baseUrl,
        jar: this.jar,
        withCredentials: true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 20000,
      })
    );
    this.authenticated = false;
    this.csrfToken = '';
  }

  async login() {
    try {
      const getLogin = await this.client.get('/login');
      const csrfMatch = getLogin.data.match(/name="csrf_token"\s+value="([^"]+)"/);
      if (!csrfMatch) {
        throw new Error('No se pudo encontrar el csrf_token en la página de login');
      }
      this.csrfToken = csrfMatch[1];

      const params = new URLSearchParams();
      params.append('csrf_token', this.csrfToken);
      params.append('userlogin', this.config.username);
      params.append('password', this.config.password);

      const postLogin = await this.client.post('/login', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: `${this.config.baseUrl}/login`,
        },
      });

      if (postLogin.request?.path?.includes('/login') && postLogin.data.includes('Invalid')) {
        throw new Error('Credenciales inválidas en MyCheats');
      }

      this.authenticated = true;
      return true;
    } catch (err) {
      this.authenticated = false;
      throw new Error(`[WorldCheats] Error de login: ${err.message}`);
    }
  }

  async ensureAuth() {
    if (!this.authenticated) {
      await this.login();
    }
  }

  /**
   * Generar Usuario y Contraseña en WorldCheats (MyCheats)
   * Contraseña siempre por defecto = 1
   */
  async createKey({ days, count = 1, prefix = 'VIP', note = '' }) {
    await this.ensureAuth();
    const createdUsers = [];
    const appId = this.config.appId || '146';
    const subId = this.config.defaultSubId || '237';

    try {
      for (let i = 0; i < count; i++) {
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        const cleanPrefix = (prefix || 'USER').trim().replace(/[^a-zA-Z0-9_]/g, '');
        const username = `${cleanPrefix}_${randSuffix}`;
        const password = '1';

        const params = new URLSearchParams();
        params.append('action', 'create_app_user');
        params.append('app_id', appId);
        params.append('app_user_expiry', '');
        params.append('app_user_username', username);
        params.append('app_user_password', password);
        params.append('app_user_subscription', String(subId));
        params.append('app_user_extra_subs', '[]');
        params.append('expiry_unit', 'Days');
        params.append('expiry_days', String(days));

        const res = await this.client.post(
          `/dashboard?page=app-users&app_id=${appId}`,
          params.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Referer: `${this.config.baseUrl}/dashboard?page=app-users&app_id=${appId}`,
            },
          }
        );

        if (res.data.includes('already exists') || res.data.includes('Username already taken')) {
          // Reintentar con otro sufijo
          const altUsername = `${cleanPrefix}_${Date.now().toString().slice(-4)}`;
          params.set('app_user_username', altUsername);
          await this.client.post(
            `/dashboard?page=app-users&app_id=${appId}`,
            params.toString(),
            {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
          );
          createdUsers.push({
            isUserAccount: true,
            username: altUsername,
            password: '1',
            key: `${altUsername}:1`,
            days,
          });
        } else {
          createdUsers.push({
            isUserAccount: true,
            username,
            password: '1',
            key: `${username}:1`,
            days,
          });
        }
      }

      return createdUsers;
    } catch (err) {
      this.authenticated = false;
      throw new Error(`[WorldCheats] Error al crear usuario: ${err.message}`);
    }
  }

  /**
   * Buscar ID interno del usuario por nombre
   */
  async findUserIdByUsername(username) {
    await this.ensureAuth();
    const appId = this.config.appId || '146';
    const res = await this.client.get(
      `/dashboard?page=app-users&app_id=${appId}&search=${encodeURIComponent(username.trim())}`
    );
    const html = res.data;

    // Buscar input name="user_id" value="(\d+)" cerca del username
    const match = html.match(
      new RegExp(
        `${username.trim()}[\\s\\S]{0,400}?name="user_id"\\s+value="(\\d+)"`,
        'i'
      )
    ) || html.match(/name="user_id"\s+value="(\d+)"/);

    if (match) {
      return match[1];
    }
    return null;
  }

  async resetHwid(usernameOrKey) {
    await this.ensureAuth();
    try {
      const appId = this.config.appId || '146';
      const cleanUser = usernameOrKey.split(':')[0].trim();
      const userId = await this.findUserIdByUsername(cleanUser);

      if (!userId) {
        throw new Error(`Usuario "${cleanUser}" no encontrado en el sistema.`);
      }

      const params = new URLSearchParams();
      params.append('user_action', 'reset_hwid');
      params.append('user_id', userId);

      await this.client.post(
        `/dashboard?page=app-users&app_id=${appId}`,
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      return `HWID del usuario "${cleanUser}" reseteado exitosamente en WorldCheats.`;
    } catch (err) {
      throw new Error(`[WorldCheats] Error al resetear HWID: ${err.message}`);
    }
  }

  async deleteKey(usernameOrKey) {
    await this.ensureAuth();
    try {
      const appId = this.config.appId || '146';
      const cleanUser = usernameOrKey.split(':')[0].trim();
      const userId = await this.findUserIdByUsername(cleanUser);

      if (!userId) {
        throw new Error(`Usuario "${cleanUser}" no encontrado en el sistema.`);
      }

      const params = new URLSearchParams();
      params.append('user_action', 'delete');
      params.append('user_id', userId);

      await this.client.post(
        `/dashboard?page=app-users&app_id=${appId}`,
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      return `Usuario "${cleanUser}" eliminado exitosamente en WorldCheats.`;
    } catch (err) {
      throw new Error(`[WorldCheats] Error al eliminar usuario: ${err.message}`);
    }
  }
}

module.exports = MyCheatsProvider;
