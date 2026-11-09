const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const defaultData = {
  // userId/roleId -> { providers: ['bypass', 'mycheats'], maxDays: 30 }
  permissions: {},
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
        this.data = { ...defaultData, ...JSON.parse(raw) };
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

  // Permisos
  getUserPermissions(member, config) {
    // Si el usuario es administrador del servidor o tiene el rol de admin configurado:
    const hasAdminRole = member.roles.cache.has(config.discord.adminRoleId);
    const isServerAdmin = member.permissions.has('Administrator');

    if (hasAdminRole || isServerAdmin) {
      return {
        isAdmin: true,
        allowedProviders: Object.keys(config.providers),
        maxDays: 30,
      };
    }

    // Buscar permisos por usuario directo
    if (this.data.permissions[member.id]) {
      return {
        isAdmin: false,
        allowedProviders: this.data.permissions[member.id].providers || [],
        maxDays: this.data.permissions[member.id].maxDays || 30,
      };
    }

    // Buscar permisos por roles del usuario
    for (const roleId of member.roles.cache.keys()) {
      if (this.data.permissions[roleId]) {
        return {
          isAdmin: false,
          allowedProviders: this.data.permissions[roleId].providers || [],
          maxDays: this.data.permissions[roleId].maxDays || 30,
        };
      }
    }

    // Sin permisos asignados
    return {
      isAdmin: false,
      allowedProviders: [],
      maxDays: 0,
    };
  }

  setPermission(targetId, providers, maxDays = 30) {
    this.data.permissions[targetId] = {
      providers: Array.isArray(providers) ? providers : [providers],
      maxDays: Number(maxDays) || 30,
      updatedAt: new Date().toISOString(),
    };
    this.save();
  }

  removePermission(targetId) {
    delete this.data.permissions[targetId];
    this.save();
  }

  getAllPermissions() {
    return this.data.permissions;
  }

  // Historial de llaves generadas
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
}

module.exports = new Database();
