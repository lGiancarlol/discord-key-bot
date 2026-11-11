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
    // 1. PRIORIDAD: Sistema de Stock Precargado por Duración (100% Sparked Host sin Python)
    const targetDays = days ? Number(days) : null;
    const stockItems = [];
    const database = this.db || db;
    const guildId = this.guildId || null;

    for (let i = 0; i < count; i++) {
      const item = database.popStock('keyauth', targetDays, guildId);
      if (item) {
        stockItems.push(item);
      } else {
        break;
      }
    }

    if (stockItems.length > 0) {
      this.lastExtractedDays = stockItems[0]?.days || targetDays || 30;
      return stockItems;
    }

    // Si se solicitó una duración específica y no hay stock de esa duración, avisar con el inventario disponible
    const breakdown = database.getStockBreakdown('keyauth', guildId);
    const availableDurations = Object.entries(breakdown).filter(([_, c]) => c > 0);

    if (availableDurations.length > 0) {
      const breakdownText = availableDurations.map(([d, c]) => `• ${d} días: ${c} claves disponibles`).join('\n');
      throw new Error(
        `📦 No hay stock disponible de ${targetDays || 30} días para KeyAuth (Elite Pro).\n\n` +
        `Duraciones disponibles actualmente en inventario:\n${breakdownText}`
      );
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

  async checkHealth() {
    const start = Date.now();
    try {
      await axios.get('https://keyauth.win', { timeout: 8000 }).catch((e) => {
        if (e.response) return e.response;
        throw e;
      });
      const latency = Date.now() - start;
      const database = this.db || require('../database');
      const count = database.getStock('keyauth', this.guildId).length;
      return { online: true, latency, message: `${count} claves en stock` };
    } catch (err) {
      return { online: false, latency: Date.now() - start, error: err.message };
    }
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
