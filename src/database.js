const fs = require('fs');
const path = require('path');
const config = require('./config');

const DB_DIR = path.join(__dirname, '..', 'data');
const GUILDS_DIR = path.join(DB_DIR, 'guilds');
const OLD_DB_FILE = path.join(DB_DIR, 'db.json');

const createDefaultGuildData = (guildId, guildName = '') => ({
  guildId,
  name: guildName || `Servidor ${guildId}`,
  channels: {
    panelChannelId: (guildId === config.discord.guildId ? config.discord.panelChannelId : '') || '',
    adminPanelChannelId: (guildId === config.discord.guildId ? config.discord.adminPanelChannelId : '') || '',
    logsChannelId: (guildId === config.discord.guildId ? config.discord.logsChannelId : '') || '',
    voiceChannelId: (guildId === config.discord.guildId ? config.discord.voiceChannelId : '') || '',
  },
  providersConfig: {
    bypass: {
      enabled: true,
      baseUrl: '',
      username: '',
      password: '',
    },
    bypass_uid: {
      enabled: true,
      baseUrl: '',
      username: '',
      password: '',
    },
    mycheats: {
      enabled: true,
      baseUrl: '',
      username: '',
      password: '',
      appId: '',
      defaultSubId: '',
    },
    keyauth: {
      enabled: true,
      sellerKey: '',
    },
  },
  botAdmins: [],
  permissions: {},
  resellers: {},
  keyStock: {
    keyauth: [],
    bypass: [],
    bypass_uid: [],
    mycheats: [],
  },
  generatedKeys: [],
});

class Database {
  constructor() {
    this.guilds = {};
    this.primaryGuildId = config.discord.guildId || 'default';
    this.init();
  }

  // Getter de compatibilidad con versiones anteriores: db.data apunta a la guild principal
  get data() {
    return this.getGuildData(this.primaryGuildId);
  }

  init() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(GUILDS_DIR)) {
      fs.mkdirSync(GUILDS_DIR, { recursive: true });
    }

    // 1. Migración de archivo db.json previo a la guild principal
    const primaryFile = path.join(GUILDS_DIR, `${this.primaryGuildId}.json`);
    if (!fs.existsSync(primaryFile) && fs.existsSync(OLD_DB_FILE)) {
      try {
        const raw = fs.readFileSync(OLD_DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        const migrated = {
          ...createDefaultGuildData(this.primaryGuildId, 'Servidor Principal'),
          ...parsed,
          botAdmins: parsed.botAdmins || [],
          keyStock: { ...createDefaultGuildData(this.primaryGuildId).keyStock, ...(parsed.keyStock || {}) },
          resellers: parsed.resellers || {},
          generatedKeys: parsed.generatedKeys || [],
        };
        fs.writeFileSync(primaryFile, JSON.stringify(migrated, null, 2), 'utf-8');
        console.log(`[Database] ✅ Migración multi-servidor completada para guild: ${this.primaryGuildId}`);
      } catch (err) {
        console.error('[Database] Error al migrar db.json previo:', err);
      }
    }

    // 2. Cargar todas las guilds existentes en memoria
    this.loadAllGuilds();

    // Asegurar que la guild principal siempre esté cargada
    this.ensureGuild(this.primaryGuildId);
  }

  loadAllGuilds() {
    try {
      const files = fs.readdirSync(GUILDS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const guildId = file.replace('.json', '');
          try {
            const raw = fs.readFileSync(path.join(GUILDS_DIR, file), 'utf-8');
            const parsed = JSON.parse(raw);
            this.guilds[guildId] = {
              ...createDefaultGuildData(guildId),
              ...parsed,
              channels: { ...createDefaultGuildData(guildId).channels, ...(parsed.channels || {}) },
              providersConfig: { ...createDefaultGuildData(guildId).providersConfig, ...(parsed.providersConfig || {}) },
              keyStock: { ...createDefaultGuildData(guildId).keyStock, ...(parsed.keyStock || {}) },
              resellers: parsed.resellers || {},
              generatedKeys: parsed.generatedKeys || [],
            };
          } catch (err) {
            console.error(`[Database] Error al leer archivo de guild ${guildId}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[Database] Error al escanear directorio de guilds:', err);
    }
  }

  ensureGuild(guildId, guildName = '') {
    const gId = guildId || this.primaryGuildId;
    if (!this.guilds[gId]) {
      const gFile = path.join(GUILDS_DIR, `${gId}.json`);
      if (fs.existsSync(gFile)) {
        try {
          const raw = fs.readFileSync(gFile, 'utf-8');
          this.guilds[gId] = JSON.parse(raw);
        } catch {
          this.guilds[gId] = createDefaultGuildData(gId, guildName);
        }
      } else {
        this.guilds[gId] = createDefaultGuildData(gId, guildName);
        this.saveGuild(gId);
      }
    } else if (guildName && this.guilds[gId].name !== guildName) {
      this.guilds[gId].name = guildName;
      this.saveGuild(gId);
    }
    return this.guilds[gId];
  }

  getGuildData(guildId) {
    const gId = guildId || this.primaryGuildId;
    return this.ensureGuild(gId);
  }

  saveGuild(guildId) {
    const gId = guildId || this.primaryGuildId;
    if (!this.guilds[gId]) return;
    try {
      const filePath = path.join(GUILDS_DIR, `${gId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(this.guilds[gId], null, 2), 'utf-8');
    } catch (err) {
      console.error(`[Database] Error al guardar datos de guild ${gId}:`, err);
    }
  }

  // Compatibilidad con llamada save() directa
  save(guildId) {
    this.saveGuild(guildId || this.primaryGuildId);
  }

  getGuildList() {
    return Object.keys(this.guilds).map((id) => ({
      id,
      name: this.guilds[id].name || id,
      resellersCount: Object.keys(this.guilds[id].resellers || {}).length,
      keysCount: (this.guilds[id].generatedKeys || []).length,
    }));
  }

  getGuildConfig(guildId) {
    const gData = this.getGuildData(guildId);
    return {
      guildId: gData.guildId,
      name: gData.name,
      channels: gData.channels || {},
      providersConfig: gData.providersConfig || {},
    };
  }

  updateGuildConfig(guildId, newConfig = {}) {
    const gData = this.getGuildData(guildId);
    if (newConfig.name) gData.name = newConfig.name;
    if (newConfig.channels) {
      gData.channels = { ...gData.channels, ...newConfig.channels };
    }
    if (newConfig.providersConfig) {
      gData.providersConfig = { ...gData.providersConfig, ...newConfig.providersConfig };
    }
    this.saveGuild(guildId);
    return this.getGuildConfig(guildId);
  }

  // ── GESTIÓN DE ADMINISTRADORES DEL BOT (POR GUILD) ──

  addBotAdmin(userId, guildId) {
    const gData = this.getGuildData(guildId);
    if (!gData.botAdmins.includes(userId)) {
      gData.botAdmins.push(userId);
      this.saveGuild(guildId);
      return true;
    }
    return false;
  }

  removeBotAdmin(userId, guildId) {
    const gData = this.getGuildData(guildId);
    const idx = gData.botAdmins.indexOf(userId);
    if (idx !== -1) {
      gData.botAdmins.splice(idx, 1);
      this.saveGuild(guildId);
      return true;
    }
    return false;
  }

  isBotAdmin(userId, guildId) {
    const gData = this.getGuildData(guildId);
    return Array.isArray(gData.botAdmins) && gData.botAdmins.includes(userId);
  }

  getBotAdmins(guildId) {
    const gData = this.getGuildData(guildId);
    return gData.botAdmins || [];
  }

  // ── GESTIÓN DE REVENDEDORES POR TIEMPO (POR GUILD) ──

  getReseller(userId, guildId) {
    const gData = this.getGuildData(guildId);
    const r = gData.resellers[userId];
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

  setReseller(userId, days, allowedProviders = [], addedBy = 'Admin', guildId) {
    const gData = this.getGuildData(guildId);
    const current = this.getReseller(userId, guildId);
    let newExpiresTime;

    if (current && !current.isExpired) {
      newExpiresTime = new Date(current.expiresAt).getTime() + (Number(days) * 24 * 60 * 60 * 1000);
    } else {
      newExpiresTime = Date.now() + (Number(days) * 24 * 60 * 60 * 1000);
    }

    gData.resellers[userId] = {
      expiresAt: new Date(newExpiresTime).toISOString(),
      allowedProviders: Array.isArray(allowedProviders) && allowedProviders.length > 0 
        ? allowedProviders 
        : ['bypass', 'bypass_uid', 'mycheats', 'keyauth'],
      maxDays: 30,
      createdAt: current ? current.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      addedBy,
    };

    this.saveGuild(guildId);
    return this.getReseller(userId, guildId);
  }

  removeReseller(userId, guildId) {
    const gData = this.getGuildData(guildId);
    if (gData.resellers[userId]) {
      delete gData.resellers[userId];
      this.saveGuild(guildId);
      return true;
    }
    return false;
  }

  getAllResellers(guildId) {
    const gData = this.getGuildData(guildId);
    return Object.keys(gData.resellers).map((id) => this.getReseller(id, guildId));
  }

  // Permisos efectivos de un miembro en una guild
  getUserPermissions(member, appConfig = config, guildId) {
    const gId = guildId || member?.guild?.id || this.primaryGuildId;
    const isServerOwner = member.guild?.ownerId === member.id;
    const isDiscordAdmin = member.permissions?.has ? member.permissions.has('Administrator') : false;
    const isDesignatedAdmin = this.isBotAdmin(member.id, gId);
    const isAdmin = isServerOwner || isDiscordAdmin || isDesignatedAdmin;

    // 1. Revendedor registrado explícitamente en esta guild
    const reseller = this.getReseller(member.id, gId);
    if (reseller) {
      return {
        isAdmin,
        isReseller: true,
        isExpired: reseller.isExpired,
        daysLeft: reseller.daysLeft,
        expiresAt: reseller.expiresAt,
        allowedProviders: reseller.isExpired ? [] : reseller.allowedProviders,
        maxDays: reseller.maxDays,
      };
    }

    // 2. Administrador
    if (isAdmin) {
      return {
        isAdmin: true,
        isReseller: true,
        isExpired: false,
        daysLeft: 9999,
        allowedProviders: Object.keys(appConfig.providers),
        maxDays: 90,
      };
    }

    // 3. Usuario sin membresía
    return {
      isAdmin: false,
      isReseller: false,
      isExpired: true,
      daysLeft: 0,
      allowedProviders: [],
      maxDays: 0,
    };
  }

  // ── GESTIÓN DE STOCK DE CLAVES (POR GUILD) ──

  addStock(providerId, keysArray, days = 30, guildId) {
    const gData = this.getGuildData(guildId);
    if (!gData.keyStock[providerId]) {
      gData.keyStock[providerId] = [];
    }
    const cleanKeys = keysArray
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    let addedCount = 0;
    for (const k of cleanKeys) {
      const exists = gData.keyStock[providerId].some((item) => {
        const val = typeof item === 'object' ? item.key : item;
        return val.toLowerCase() === k.toLowerCase();
      });
      if (!exists) {
        gData.keyStock[providerId].push({
          key: k,
          days: Number(days) || 30,
        });
        addedCount++;
      }
    }
    this.saveGuild(guildId);
    return {
      added: addedCount,
      total: gData.keyStock[providerId].length,
    };
  }

  popStock(providerId, targetDays = null, guildId = null) {
    let actualDays = targetDays;
    let actualGuildId = guildId;

    if (typeof targetDays === 'string' && targetDays.length > 10 && !guildId) {
      actualGuildId = targetDays;
      actualDays = null;
    }

    const gData = this.getGuildData(actualGuildId);
    if (!gData.keyStock[providerId] || gData.keyStock[providerId].length === 0) {
      return null;
    }

    let index = -1;
    if (actualDays !== null && actualDays !== undefined) {
      const numDays = Number(actualDays);
      if (!isNaN(numDays) && numDays > 0) {
        index = gData.keyStock[providerId].findIndex((item) => {
          const itemDays = typeof item === 'object' && item && item.days ? Number(item.days) : 30;
          return itemDays === numDays;
        });

        // Si se especificó una duración y no hay stock con esa duración, retornar null
        if (index === -1) {
          return null;
        }
      }
    }

    if (index === -1) {
      index = 0;
    }

    const [item] = gData.keyStock[providerId].splice(index, 1);
    this.saveGuild(actualGuildId);

    if (typeof item === 'object' && item !== null && item.key) {
      return { key: item.key, days: Number(item.days) || 30 };
    }
    return { key: item, days: actualDays ? Number(actualDays) : 30 };
  }

  getStockBreakdown(providerId, guildId = null) {
    const gData = this.getGuildData(guildId);
    const list = gData.keyStock[providerId] || [];
    const breakdown = {};
    for (const item of list) {
      const days = typeof item === 'object' && item && item.days ? Number(item.days) : 30;
      breakdown[days] = (breakdown[days] || 0) + 1;
    }
    return breakdown;
  }

  getStock(providerId, guildId) {
    const gData = this.getGuildData(guildId);
    return gData.keyStock[providerId] || [];
  }

  getAllStock(guildId) {
    const gData = this.getGuildData(guildId);
    const res = {};
    for (const [p, keys] of Object.entries(gData.keyStock || {})) {
      res[p] = (keys || []).length;
    }
    return res;
  }

  // ── HISTORIAL DE CLAVES (POR GUILD) ──

  recordKey({ userId, providerId, key, days, prefix = '', note = '' }, guildId) {
    const gData = this.getGuildData(guildId);
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
    gData.generatedKeys.push(item);
    this.saveGuild(guildId);
    return item;
  }

  getUserKeys(userId, limit = 20, guildId) {
    const gData = this.getGuildData(guildId);
    return (gData.generatedKeys || [])
      .filter((k) => k.userId === userId)
      .slice(-limit)
      .reverse();
  }

  getAllKeys(limit = 100, guildId) {
    const gData = this.getGuildData(guildId);
    return (gData.generatedKeys || [])
      .slice(-limit)
      .reverse();
  }

  findKey(key, guildId) {
    if (!key) return null;
    const clean = key.trim().toLowerCase();
    
    // Si se pasa guildId específico, buscar en esa guild
    if (guildId) {
      const gData = this.getGuildData(guildId);
      return (gData.generatedKeys || []).find((k) => {
        const kVal = (k.key || '').trim().toLowerCase();
        return kVal === clean || kVal.includes(clean);
      });
    }

    // Si no, buscar en la guild principal primero
    const primaryData = this.getGuildData(this.primaryGuildId);
    const foundPrimary = (primaryData.generatedKeys || []).find((k) => {
      const kVal = (k.key || '').trim().toLowerCase();
      return kVal === clean || kVal.includes(clean);
    });
    if (foundPrimary) return foundPrimary;

    // O en cualquier otra guild
    for (const g of Object.values(this.guilds)) {
      const found = (g.generatedKeys || []).find((k) => {
        const kVal = (k.key || '').trim().toLowerCase();
        return kVal === clean || kVal.includes(clean);
      });
      if (found) return found;
    }

    return null;
  }

  deleteKeyRecord(keyId, guildId) {
    const gData = this.getGuildData(guildId);
    const idx = (gData.generatedKeys || []).findIndex((k) => k.id === keyId || k.key === keyId);
    if (idx !== -1) {
      gData.generatedKeys.splice(idx, 1);
      this.saveGuild(guildId);
      return true;
    }
    return false;
  }

  // Interfaz fluida para operar sobre una guild en particular
  forGuild(guildId) {
    const gId = guildId || this.primaryGuildId;
    this.ensureGuild(gId);
    return {
      guildId: gId,
      getData: () => this.getGuildData(gId),
      getConfig: () => this.getGuildConfig(gId),
      updateConfig: (cfg) => this.updateGuildConfig(gId, cfg),
      addBotAdmin: (userId) => this.addBotAdmin(userId, gId),
      removeBotAdmin: (userId) => this.removeBotAdmin(userId, gId),
      isBotAdmin: (userId) => this.isBotAdmin(userId, gId),
      getBotAdmins: () => this.getBotAdmins(gId),
      getReseller: (userId) => this.getReseller(userId, gId),
      setReseller: (userId, days, allowedProviders, addedBy) => this.setReseller(userId, days, allowedProviders, addedBy, gId),
      removeReseller: (userId) => this.removeReseller(userId, gId),
      getAllResellers: () => this.getAllResellers(gId),
      getUserPermissions: (member, cfg) => this.getUserPermissions(member, cfg, gId),
      addStock: (providerId, keysArray, days) => this.addStock(providerId, keysArray, days, gId),
      popStock: (providerId, targetDays) => this.popStock(providerId, targetDays, gId),
      getStock: (providerId) => this.getStock(providerId, gId),
      getStockBreakdown: (providerId) => this.getStockBreakdown(providerId, gId),
      getAllStock: () => this.getAllStock(gId),
      recordKey: (params) => this.recordKey(params, gId),
      getUserKeys: (userId, limit) => this.getUserKeys(userId, limit, gId),
      getAllKeys: (limit) => this.getAllKeys(limit, gId),
      findKey: (key) => this.findKey(key, gId),
      deleteKeyRecord: (keyId) => this.deleteKeyRecord(keyId, gId),
    };
  }
}

module.exports = new Database();
