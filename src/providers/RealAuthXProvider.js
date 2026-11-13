const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const BaseProvider = require('./BaseProvider');

class RealAuthXProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.id = config.id || 'realauthx';
    this.name = config.name || 'RealAuthX (Roblox)';
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        baseURL: this.config.baseUrl || 'https://www.realauthx.com',
        jar: this.jar,
        withCredentials: true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 25000,
      })
    );
    this.authenticated = false;
    this.detectedAppId = null;
  }

  async login() {
    try {
      const username = this.config.username || 'GianAdmin1';
      const password = this.config.password || 'GianAdmin2';
      console.log(`[RealAuthX] Iniciando sesión para usuario "${username}"...`);

      // 1. Obtener cookies iniciales
      await this.client.get('/');

      // 2. Enviar formulario de inicio de sesión
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);
      params.append('otp', '');
      params.append('remember_user', '1');

      const loginRes = await this.client.post('/login', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: `${this.config.baseUrl || 'https://www.realauthx.com'}/`,
          Origin: this.config.baseUrl || 'https://www.realauthx.com',
        },
      });

      if (typeof loginRes.data === 'object' && loginRes.data.status === 'error') {
        throw new Error(loginRes.data.message || 'Credenciales inválidas en RealAuthX');
      }

      this.authenticated = true;

      // 3. Autodetectar App ID si no está fijado en la configuración
      try {
        const dashRes = await this.client.get('/dashboard');
        const dashHtml = dashRes.data || '';
        const appMatches = [...dashHtml.matchAll(/app_id=(\d+)/g)].map((m) => m[1]);
        if (appMatches.length > 0) {
          const uniqueApps = [...new Set(appMatches)];
          this.detectedAppId = uniqueApps[0];
          console.log(`[RealAuthX] Cuenta "${username}" autenticada exitosamente. App detectada: ${this.detectedAppId}`);
        } else {
          console.log(`[RealAuthX] Cuenta "${username}" autenticada exitosamente.`);
        }
      } catch (_) {
        console.log(`[RealAuthX] Cuenta "${username}" autenticada exitosamente.`);
      }

      return true;
    } catch (err) {
      this.authenticated = false;
      throw new Error(`[RealAuthX] Error de autenticación: ${err.message}`);
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
      const appId = (this.config.appId && String(this.config.appId).trim()) || this.detectedAppId || '521';
      await this.client.get(`/dashboard?app_id=${appId}&section=licenses`);
      const latency = Date.now() - start;
      return { online: true, latency, message: 'Sesión activa y panel operativo' };
    } catch (err) {
      return { online: false, latency: Date.now() - start, error: err.message };
    }
  }

  async getSubscriptions() {
    const fallback = [{ id: '715', name: 'default (L1)' }];
    try {
      await this.ensureAuth();
      const appId = (this.config.appId && String(this.config.appId).trim()) || this.detectedAppId || '521';
      const res = await this.client.get(`/dashboard?app_id=${appId}&section=licenses`);
      const html = res.data || '';

      const selectMatch = html.match(/<select[^>]*id=['"]licenseSubscription['"][^>]*>([\s\S]*?)<\/select>/i);
      if (selectMatch) {
        const optRe = /<option[^>]*value=['"](\d+)['"][^>]*>([\s\S]*?)<\/option>/gi;
        let m;
        const subs = [];
        while ((m = optRe.exec(selectMatch[1])) !== null) {
          const cleanName = m[2].replace(/<[^>]+>/g, '').trim();
          subs.push({ id: m[1], name: cleanName });
        }
        if (subs.length > 0) return subs;
      }
    } catch (_) {}

    return fallback;
  }

  /**
   * Generar Licencias en RealAuthX
   */
  async createKey({ days = 30, count = 1, prefix = '', note = '', subId = null }) {
    await this.ensureAuth();
    const appId = (this.config.appId && String(this.config.appId).trim()) || this.detectedAppId || '521';
    const effectiveSubId = subId || (this.config.defaultSubId && String(this.config.defaultSubId).trim()) || '715';

    // Obtener claves existentes antes de la creación para detectar exactamente las nuevas
    const beforeRes = await this.client.get(`/dashboard?app_id=${appId}&section=licenses`);
    const beforeHtml = beforeRes.data || '';
    const beforeKeys = new Set([...beforeHtml.matchAll(/data-license-key=['"]([^'"]+)['"]/g)].map((m) => m[1]));

    // Construir la máscara de licencia
    let mask = '******-******-******-******';
    if (prefix && String(prefix).trim()) {
      const cleanPrefix = String(prefix).trim().toUpperCase();
      if (cleanPrefix.includes('-')) {
        mask = `${cleanPrefix}-******`;
      } else {
        mask = `${cleanPrefix}-******-******`;
      }
    }

    const params = new URLSearchParams();
    params.append('app_id', String(appId));
    params.append('quantity', String(count));
    params.append('license_mask', mask);
    params.append('max_uses', '1');
    params.append('subscription_id', String(effectiveSubId));
    params.append('license_case', 'upper');
    params.append('expiry_unit', 'days');
    params.append('expiry_duration', String(days));
    params.append('note', note ? String(note).slice(0, 500) : '');

    const createRes = await this.client.post('/dashboard/license/create', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${this.config.baseUrl || 'https://www.realauthx.com'}/dashboard?app_id=${appId}&section=licenses`,
        Origin: this.config.baseUrl || 'https://www.realauthx.com',
      },
    });

    if (createRes.request?.path?.includes('/login')) {
      this.authenticated = false;
      throw new Error('La sesión de RealAuthX caducó al intentar crear la licencia.');
    }

    // Obtener la página actualizada y detectar las claves creadas
    const afterRes = await this.client.get(`/dashboard?app_id=${appId}&section=licenses`);
    const afterHtml = afterRes.data || '';

    // Mapear cada fila con su data-license-key y license_id
    const rowRe = /<tr[^>]*data-license-key=['"]([^'"]+)['"][\s\S]*?<input type=['"]hidden['"] name=['"]license_id['"] value=['"](\d+)['"]/gi;
    let match;
    const createdKeys = [];

    while ((match = rowRe.exec(afterHtml)) !== null) {
      const keyVal = match[1];
      const licId = match[2];
      if (!beforeKeys.has(keyVal)) {
        createdKeys.push({
          key: keyVal,
          licenseId: licId,
          days,
          subId: effectiveSubId,
          subName: 'default (L1)',
        });
        if (createdKeys.length >= count) break;
      }
    }

    // Si por alguna razón la detección de filas no arrojó la cantidad esperada, buscar en el flash message o claves nuevas
    if (createdKeys.length === 0) {
      const allAfterKeys = [...afterHtml.matchAll(/data-license-key=['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const k of allAfterKeys) {
        if (!beforeKeys.has(k)) {
          createdKeys.push({ key: k, days, subId: effectiveSubId });
          if (createdKeys.length >= count) break;
        }
      }
    }

    if (createdKeys.length === 0) {
      throw new Error('No se pudo verificar la creación de la clave en RealAuthX.');
    }

    return createdKeys;
  }

  /**
   * Buscar el ID numérico interno (license_id) asociado a una clave
   */
  async findLicenseId(key) {
    await this.ensureAuth();
    const appId = (this.config.appId && String(this.config.appId).trim()) || this.detectedAppId || '521';
    const res = await this.client.get(`/dashboard?app_id=${appId}&section=licenses`);
    const html = res.data || '';

    const cleanKey = String(key).trim();
    // Buscar la fila correspondiente
    const escapedKey = cleanKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `<tr[^>]*data-license-key=['"]${escapedKey}['"][\\s\\S]*?<input type=['"]hidden['"] name=['"]license_id['"] value=['"](\\d+)['"]`,
      'i'
    );
    const m = html.match(regex);
    return m ? m[1] : null;
  }

  /**
   * Resetear HWID en RealAuthX
   */
  async resetHwid(key) {
    await this.ensureAuth();
    const appId = (this.config.appId && String(this.config.appId).trim()) || this.detectedAppId || '521';
    const licenseId = await this.findLicenseId(key);

    if (!licenseId) {
      throw new Error(`No se encontró la clave "${key}" en el panel de RealAuthX.`);
    }

    const params = new URLSearchParams();
    params.append('app_id', String(appId));
    params.append('license_id', String(licenseId));

    const res = await this.client.post('/dashboard/license/reset', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${this.config.baseUrl || 'https://www.realauthx.com'}/dashboard?app_id=${appId}&section=licenses`,
      },
    });

    if (res.request?.path?.includes('/login')) {
      this.authenticated = false;
      throw new Error('La sesión de RealAuthX caducó al intentar resetear HWID.');
    }

    return { success: true, message: `HWID de la licencia ${key} reseteado exitosamente.` };
  }

  /**
   * Eliminar Licencia en RealAuthX
   */
  async deleteKey(key) {
    await this.ensureAuth();
    const appId = (this.config.appId && String(this.config.appId).trim()) || this.detectedAppId || '521';
    const licenseId = await this.findLicenseId(key);

    if (!licenseId) {
      throw new Error(`No se encontró la clave "${key}" en RealAuthX para eliminar.`);
    }

    const params = new URLSearchParams();
    params.append('app_id', String(appId));
    params.append('license_id', String(licenseId));

    const res = await this.client.post('/dashboard/license/delete', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${this.config.baseUrl || 'https://www.realauthx.com'}/dashboard?app_id=${appId}&section=licenses`,
      },
    });

    if (res.request?.path?.includes('/login')) {
      this.authenticated = false;
      throw new Error('La sesión de RealAuthX caducó al intentar eliminar la licencia.');
    }

    return { success: true, message: `Licencia ${key} eliminada correctamente de RealAuthX.` };
  }

  /**
   * Listar claves desde el panel
   */
  async listKeys() {
    await this.ensureAuth();
    const appId = (this.config.appId && String(this.config.appId).trim()) || this.detectedAppId || '521';
    const res = await this.client.get(`/dashboard?app_id=${appId}&section=licenses`);
    const html = res.data || '';

    const keys = [];
    const re = /<tr[^>]*data-license-key=['"]([^'"]+)['"][\s\S]*?<input type=['"]hidden['"] name=['"]license_id['"] value=['"](\d+)['"]/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      keys.push({
        key: m[1],
        licenseId: m[2],
      });
    }
    return keys;
  }
}

module.exports = RealAuthXProvider;
