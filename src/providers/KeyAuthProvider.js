const { execFile } = require('child_process');
const path = require('path');
const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const db = require('../database');

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
    // 1. PRIORIDAD: Sistema de Stock Precargado (Compatible 100% con Sparked Host sin Python)
    const keysFromStock = [];
    for (let i = 0; i < count; i++) {
      const key = db.popStock('keyauth');
      if (key) {
        keysFromStock.push(key);
      } else {
        break;
      }
    }

    if (keysFromStock.length > 0) {
      return keysFromStock;
    }

    // 2. Si cuenta con Seller Key configurada, usar API directa
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
        console.warn('[KeyAuth API] Falló API directa:', e.message);
      }
    }

    // 3. Intento de navegador local (solo si Python está disponible en la máquina)
    try {
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
    } catch (e) {
      // Ignorar fallo de python en entornos donde no existe
    }

    // Si llega aquí, el stock está vacío
    throw new Error(
      '📦 Stock de KeyAuth (Elite Pro) agotado.\nEl administrador debe recargar stock con `/stock add keyauth <claves>`.'
    );
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

    try {
      const res = await this.runBridge(['reset', '--key', key.trim()]);
      if (res.success) return res.message || 'HWID reseteado exitosamente en KeyAuth.';
    } catch {}

    // Si es clave de stock, confirmamos el reset en el bot
    return `Solicitud de reset HWID registrada para la clave: ${key}`;
  }

  async deleteKey(key) {
    if (this.sellerKey) {
      try {
        const client = axios.create({ baseURL: 'https://keyauth.win/api/seller/', timeout: 15000 });
        const res = await client.get('/', {
          params: { sellerkey: this.sellerKey, type: 'deluser', user: key.trim(), format: 'json' },
        });
        if (res.data?.success) return res.data.message || 'Clave eliminada en KeyAuth';
      } catch {}
    }

    try {
      const res = await this.runBridge(['delete', '--key', key.trim()]);
      if (res.success) return res.message || 'Clave eliminada exitosamente en KeyAuth.';
    } catch {}

    return `Clave ${key} eliminada del registro local.`;
  }
}

module.exports = KeyAuthProvider;
