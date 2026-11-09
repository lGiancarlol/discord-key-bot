const { execFile } = require('child_process');
const path = require('path');
const axios = require('axios');
const BaseProvider = require('./BaseProvider');

class KeyAuthProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.sellerKey = config.sellerKey || '';
    this.scriptPath = path.join(__dirname, '..', '..', 'scripts', 'keyauth_bridge.py');
  }

  async login() {
    return true;
  }

  runBridge(args) {
    return new Promise((resolve, reject) => {
      execFile('python', [this.scriptPath, ...args], { timeout: 65000 }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(stderr || error.message));
        }
        try {
          // Extraer último bloque JSON en caso de advertencias previas
          const match = stdout.match(/\{[\s\S]*\}$/);
          if (match) {
            const data = JSON.parse(match[0]);
            return resolve(data);
          }
          resolve(JSON.parse(stdout.trim()));
        } catch (e) {
          reject(new Error(`Respuesta inválida del puente KeyAuth: ${stdout}`));
        }
      });
    });
  }

  async createKey({ days, count = 1, prefix = 'Tryhard', note = '' }) {
    // 1. Si cuenta con Seller Key configurada, usar API directa
    if (this.sellerKey) {
      try {
        const client = axios.create({ baseURL: 'https://keyauth.win/api/seller/', timeout: 15000 });
        const mask = `${prefix.trim().toUpperCase()}-******`;
        const res = await client.get('/', {
          params: {
            sellerkey: this.sellerKey,
            type: 'add',
            expiry: days,
            mask: mask,
            level: 1,
            amount: count,
            format: 'json',
            note: note,
          },
        });
        if (res.data && res.data.success) {
          return res.data.keys || [res.data.key];
        }
      } catch (e) {
        console.warn('[KeyAuth API] Falló API directa, intentando con navegador automatizado...');
      }
    }

    // 2. Usar navegador automatizado anti-Cloudflare (Undetected Chrome)
    const mask = `${(prefix || 'Tryhard').trim()}-******`;
    const res = await this.runBridge([
      'create',
      '--days',
      String(days),
      '--count',
      String(count),
      '--mask',
      mask,
    ]);

    if (res.success && res.keys && res.keys.length > 0) {
      return res.keys;
    }

    throw new Error(res.error || 'No se pudieron generar las claves en KeyAuth');
  }

  async resetHwid(key) {
    if (this.sellerKey) {
      try {
        const client = axios.create({ baseURL: 'https://keyauth.win/api/seller/', timeout: 15000 });
        const res = await client.get('/', {
          params: { sellerkey: this.sellerKey, type: 'resetuser', user: key.trim(), format: 'json' },
        });
        if (res.data?.success) return res.data.message || 'HWID reseteado en KeyAuth';
      } catch {}
    }

    const res = await this.runBridge(['reset', '--key', key.trim()]);
    if (res.success) return res.message || 'HWID reseteado exitosamente en KeyAuth.';
    throw new Error(res.error || 'Error al resetear HWID');
  }

  async deleteKey(key) {
    if (this.sellerKey) {
      try {
        const client = axios.create({ baseURL: 'https://keyauth.win/api/seller/', timeout: 15000 });
        const res = await client.get('/', {
          params: { sellerkey: this.sellerKey, type: 'del', key: key.trim(), format: 'json' },
        });
        if (res.data?.success) return res.data.message || 'Key eliminada en KeyAuth';
      } catch {}
    }

    const res = await this.runBridge(['delete', '--key', key.trim()]);
    if (res.success) return res.message || 'Licencia eliminada exitosamente en KeyAuth.';
    throw new Error(res.error || 'Error al eliminar');
  }
}

module.exports = KeyAuthProvider;
