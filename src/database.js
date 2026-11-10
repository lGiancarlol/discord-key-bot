const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const defaultData = {
  // userId/roleId -> { providers: ['bypass', 'mycheats'], maxDays: 30 }
  permissions: {},
  // Revendedores: userId -> { expiresAt: ISO, allowedProviders: [], maxDays: 30, createdAt: ISO, addedBy: string }
  resellers: {},
  // Stock de claves precargadas: providerId -> ['KEY-1', 'KEY-2', ...]
  keyStock: {
    keyauth: [],
    bypass: [],
    bypass_uid: [],
    mycheats: [],
  },
  // array of { id, userId, providerId, key, days, prefix, note, createdAt }
  generatedKeys: [],
};

class Database {
  constructor() {
    this.data = defaultData;
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          ...defaultData,
          ...parsed,
          keyStock: { ...defaultData.keyStock, ...(parsed.keyStock || {}) },
          resellers: parsed.resellers || {},
        };
      } catch (err) {
        console.error('Error reading db.json, using defaults:', err);
        this.data = defaultData;
      }
    } else {
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving db.json:', err);
    }
  }

  // ── GESTIÓN DE REVENDEDORES POR TIEMPO ──

  getReseller(userId) {
    const r = this.data.resellers[userId];
    if (!r) return null;

    const expiresTime = new Date(r.expiresAt).getTime();
    const now = Date.now();
    const isExpired = now >= expiresTime;
    const diffMs = Math.max(0, expiresTime - now);
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      userId,
      expiresAt: r.expiresAt,
      isExpired,
      daysLeft,
      allowedProviders: r.allowedProviders || [],
      maxDays: r.maxDays || 30,
      createdAt: r.createdAt,
      addedBy: r.addedBy || 'Admin',
    };
  }

  setReseller(userId, days, allowedProviders = [], addedBy = 'Admin') {
    const current = this.getReseller(userId);
    let newExpiresTime;

    // Si ya está activo, le sumamos los días; si ya expiró o es nuevo, desde ahora
    if (current && !current.isExpired) {
      newExpiresTime = new Date(current.expiresAt).getTime() + (Number(days) * 24 * 60 * 60 * 1000);
    } else {
      newExpiresTime = Date.now() + (Number(days) * 24 * 60 * 60 * 1000);
    }

    this.data.resellers[userId] = {
      expiresAt: new Date(newExpiresTime).toISOString(),
      allowedProviders: Array.isArray(allowedProviders) && allowedProviders.length > 0 
        ? allowedProviders 
        : ['bypass', 'bypass_uid', 'mycheats', 'keyauth'],
      maxDays: 30,
      createdAt: current ? current.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      addedBy,
    };

    this.save();
    return this.getReseller(userId);
  }

  removeReseller(userId) {
    if (this.data.resellers[userId]) {
      delete this.data.resellers[userId];
      this.save();
      return true;
    }
    return false;
  }

  getAllResellers() {
    return Object.keys(this.data.resellers).map((id) => this.getReseller(id));
  }

  // Permisos efectivos de un miembro
  getUserPermissions(member, config) {
    const isServerOwner = member.guild?.ownerId === member.id;
    const isDiscordAdmin = member.permissions?.has('Administrator');

    // 1. Revendedor registrado explícitamente mediante comando
    const reseller = this.getReseller(member.id);
    if (reseller) {
      return {
        isAdmin: isServerOwner || isDiscordAdmin,
        isReseller: true,
        isExpired: reseller.isExpired,
        daysLeft: reseller.daysLeft,
        expiresAt: reseller.expiresAt,
        allowedProviders: reseller.isExpired ? [] : reseller.allowedProviders,
        maxDays: reseller.maxDays,
      };
    }

    // 2. Administrador del servidor / Dueño (si no está registrado como revendedor)
    if (isServerOwner || isDiscordAdmin) {
      return {
        isAdmin: true,
        isReseller: true,
        isExpired: false,
        daysLeft: 9999,
        allowedProviders: Object.keys(config.providers),
        maxDays: 90,
      };
    }

    // 3. Cualquier otro usuario (aunque tenga roles en el servidor)
    // NO tiene acceso hasta que se le asigne con /revendedor asignar
    return {
      isAdmin: false,
      isReseller: false,
      isExpired: true,
      daysLeft: 0,
      allowedProviders: [],
      maxDays: 0,
    };
  }

  // ── GESTIÓN DE STOCK DE CLAVES ──

  addStock(providerId, keysArray) {
    if (!this.data.keyStock[providerId]) {
      this.data.keyStock[providerId] = [];
    }
    const cleanKeys = keysArray
      .map((k) => k.trim())
      .filter((k) => k.length > 0 && !this.data.keyStock[providerId].includes(k));

    this.data.keyStock[providerId].push(...cleanKeys);
    this.save();
    return {
      added: cleanKeys.length,
      total: this.data.keyStock[providerId].length,
    };
  }

  popStock(providerId) {
    if (!this.data.keyStock[providerId] || this.data.keyStock[providerId].length === 0) {
      return null;
    }
    const key = this.data.keyStock[providerId].shift();
    this.save();
    return key;
  }

  getStock(providerId) {
    return this.data.keyStock[providerId] || [];
  }

  getAllStock() {
    const res = {};
    for (const [p, keys] of Object.entries(this.data.keyStock)) {
      res[p] = (keys || []).length;
    }
    return res;
  }

  // ── HISTORIAL DE CLAVES ──

  recordKey({ userId, providerId, key, days, prefix = '', note = '' }) {
    const item = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      providerId,
      key,
      days,
      prefix,
      note,
      createdAt: new Date().toISOString(),
    };
    this.data.generatedKeys.push(item);
    this.save();
    return item;
  }

  getUserKeys(userId, limit = 20) {
    return this.data.generatedKeys
      .filter((k) => k.userId === userId)
      .slice(-limit)
      .reverse();
  }

  findKey(key) {
    const clean = key.trim().toLowerCase();
    return this.data.generatedKeys.find(
      (k) => (k.key && k.key.trim().toLowerCase() === clean) || (k.note && k.note.toLowerCase().includes(clean))
    );
  }
}

module.exports = new Database();
