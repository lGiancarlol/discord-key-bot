const fs = require('fs');
const path = require('path');
const config = require('./config');

const DB_DIR = path.join(__dirname, '..', 'data');
const GUILDS_DIR = path.join(DB_DIR, 'guilds');
const BACKUPS_DIR = path.join(DB_DIR, 'backups');
const OLD_DB_FILE = path.join(DB_DIR, 'db.json');

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const createDefaultGuildData = (guildId, guildName = '') => ({
  guildId,
  name: guildName || `Servidor ${guildId}`,
  channels: {
    panelChannelId: (guildId === config.discord.guildId ? config.discord.panelChannelId : '') || '',
    adminPanelChannelId: (guildId === config.discord.guildId ? config.discord.adminPanelChannelId : '') || '',
    logsChannelId: (guildId === config.discord.guildId ? config.discord.logsChannelId : '') || '',
    voiceChannelId: (guildId === config.discord.guildId ? config.discord.voiceChannelId : '') || '',
  },
  customTemplate: {
    storeName: 'Auth Cloud Gateway',
    noteText: 'Válida para 1 solo dispositivo.',
    footerText: '',
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
    this.floodMap = new Map(); // Anti-Flood Map: `${guildId}:${userId}` -> { timestamps: number[], cooldownUntil: number }
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
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
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
        this.atomicWriteFile(primaryFile, JSON.stringify(migrated, null, 2));
        console.log(`[Database] ✅ Migración multi-servidor completada para guild: ${this.primaryGuildId}`);
      } catch (err) {
        console.error('[Database] Error al migrar db.json previo:', err);
      }
    }

    // 2. Cargar todas las guilds existentes en memoria
    this.loadAllGuilds();

    // Asegurar que la guild principal siempre esté cargada
    this.ensureGuild(this.primaryGuildId);

    // 3. Iniciar rutina de respaldos automáticos
    this.setupAutoBackups();
  }

  atomicWriteFile(filePath, content) {
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
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
              customTemplate: { ...createDefaultGuildData(guildId).customTemplate, ...(parsed.customTemplate || {}) },
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
      this.atomicWriteFile(filePath, JSON.stringify(this.guilds[gId], null, 2));
    } catch (err) {
      console.error(`[Database] Error al guardar datos de guild ${gId}:`, err);
    }
  }

  // Compatibilidad con llamada save() directa
  save(guildId) {
    this.saveGuild(guildId || this.primaryGuildId);
  }

  // ── SISTEMA DE RESPALDOS AUTOMÁTICOS (BACKUPS) ──

  createBackup() {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(BACKUPS_DIR, `backup-${timestamp}.json`);
      const payload = {
        createdAt: new Date().toISOString(),
        version: '2.0',
        guildsCount: Object.keys(this.guilds).length,
        guilds: this.guilds,
      };

      this.atomicWriteFile(backupPath, JSON.stringify(payload, null, 2));
      console.log(`[Backup] 💾 Respaldo automático creado: backup-${timestamp}.json`);

      // Mantener únicamente los últimos 10 respaldos
      this.pruneOldBackups(10);
      return backupPath;
    } catch (err) {
      console.error('[Backup] Error al crear respaldo automático:', err);
      return null;
    }
  }

  pruneOldBackups(keepCount = 10) {
    try {
      const files = fs.readdirSync(BACKUPS_DIR)
        .filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > keepCount) {
        for (let i = keepCount; i < files.length; i++) {
          try {
            fs.unlinkSync(path.join(BACKUPS_DIR, files[i].name));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('[Backup] Error al purgar respaldos antiguos:', err);
    }
  }

  setupAutoBackups() {
    // 1. Respaldo al iniciar si no hay ninguno en las últimas 24h
    try {
      const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith('backup-') && f.endsWith('.json'));
      if (files.length === 0) {
        this.createBackup();
      }
    } catch (_) {
      this.createBackup();
    }

    // 2. Programar intervalo cada 24 horas
    if (!this._backupInterval) {
      this._backupInterval = setInterval(() => {
        this.createBackup();
      }, 24 * 60 * 60 * 1000);
      if (this._backupInterval.unref) this._backupInterval.unref();
    }
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
      customTemplate: gData.customTemplate || {
        storeName: 'Auth Cloud Gateway',
        noteText: 'Válida para 1 solo dispositivo.',
        footerText: '',
      },
      providersConfig: gData.providersConfig || {},
    };
  }

  updateGuildConfig(guildId, newConfig = {}) {
    const gData = this.getGuildData(guildId);
    if (newConfig.name) gData.name = newConfig.name;
    if (newConfig.channels) {
      gData.channels = { ...gData.channels, ...newConfig.channels };
    }
    if (newConfig.customTemplate) {
      gData.customTemplate = { ...(gData.customTemplate || {}), ...newConfig.customTemplate };
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

  // ── GESTIÓN DE REVENDEDORES POR TIEMPO Y CUOTAS DIARIAS (POR GUILD) ──

  getReseller(userId, guildId) {
    const gData = this.getGuildData(guildId);
    const r = gData.resellers[userId];
    if (!r) return null;

    const expiresTime = new Date(r.expiresAt).getTime();
    const now = Date.now();
    const isExpired = now >= expiresTime;
    const diffMs = Math.max(0, expiresTime - now);
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const today = getTodayKey();
    const usedToday = (r.dailyUsage && r.dailyUsage[today]) ? Number(r.dailyUsage[today]) : 0;
    const dailyLimit = r.dailyLimit ? Number(r.dailyLimit) : 0;
    const remainingToday = dailyLimit > 0 ? Math.max(0, dailyLimit - usedToday) : null;

    return {
      userId,
      expiresAt: r.expiresAt,
      isExpired,
      daysLeft,
      allowedProviders: r.allowedProviders || [],
      maxDays: r.maxDays || 30,
      dailyLimit,
      usedToday,
      remainingToday,
      createdAt: r.createdAt,
      addedBy: r.addedBy || 'Admin',
    };
  }

  setReseller(userId, days, allowedProviders = [], addedBy = 'Admin', dailyLimit = 0, guildId) {
    // Si guildId vino en el argumento dailyLimit por sobrecarga
    let actualGuildId = guildId;
    let actualLimit = Number(dailyLimit) || 0;
    if (typeof dailyLimit === 'string' && dailyLimit.length > 10 && !guildId) {
      actualGuildId = dailyLimit;
      actualLimit = 0;
    }

    const gData = this.getGuildData(actualGuildId);
    const current = this.getReseller(userId, actualGuildId);
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
      dailyLimit: actualLimit > 0 ? actualLimit : 0,
      dailyUsage: current && gData.resellers[userId]?.dailyUsage ? gData.resellers[userId].dailyUsage : {},
      createdAt: current ? current.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      addedBy,
    };

    this.saveGuild(actualGuildId);
    return this.getReseller(userId, actualGuildId);
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

  // ── CUOTA DIARIA DE GENERACIÓN DE CLAVES ──

  checkResellerQuota(userId, countToGenerate = 1, guildId) {
    const gId = guildId || this.primaryGuildId;
    // Admins no tienen límite diario
    if (this.isBotAdmin(userId, gId) || userId === config.discord.ownerId) {
      return { allowed: true, quotaExceeded: false, dailyLimit: 0, usedToday: 0 };
    }

    const reseller = this.getReseller(userId, gId);
    if (!reseller) {
      return { allowed: false, quotaExceeded: false, error: 'No es revendedor registrado.' };
    }

    if (!reseller.dailyLimit || reseller.dailyLimit <= 0) {
      return { allowed: true, quotaExceeded: false, dailyLimit: 0, usedToday: reseller.usedToday };
    }

    if (reseller.usedToday + Number(countToGenerate) > reseller.dailyLimit) {
      return {
        allowed: false,
        quotaExceeded: true,
        dailyLimit: reseller.dailyLimit,
        usedToday: reseller.usedToday,
        remainingToday: Math.max(0, reseller.dailyLimit - reseller.usedToday),
      };
    }

    return {
      allowed: true,
      quotaExceeded: false,
      dailyLimit: reseller.dailyLimit,
      usedToday: reseller.usedToday,
      remainingToday: reseller.dailyLimit - reseller.usedToday - countToGenerate,
    };
  }

  incrementResellerUsage(userId, count = 1, guildId) {
    const gId = guildId || this.primaryGuildId;
    const gData = this.getGuildData(gId);
    const r = gData.resellers[userId];
    if (!r) return;

    if (!r.dailyUsage) r.dailyUsage = {};
    const today = getTodayKey();
    r.dailyUsage[today] = (Number(r.dailyUsage[today]) || 0) + Number(count);

    // Limpiar fechas antiguas (mantener solo los últimos 7 días)
    const keys = Object.keys(r.dailyUsage);
    if (keys.length > 7) {
      keys.sort();
      while (keys.length > 7) {
        delete r.dailyUsage[keys.shift()];
      }
    }

    this.saveGuild(gId);
  }

  // ── SISTEMA ANTI-FLOOD / ANTI-SPAM (BURST RATE LIMITER) ──

  checkAntiFlood(userId, guildId) {
    const gId = guildId || this.primaryGuildId;
    // Admins y Dueño no están sujetos a Anti-Flood
    if (this.isBotAdmin(userId, gId) || userId === config.discord.ownerId) {
      return { allowed: true };
    }

    const key = `${gId}:${userId}`;
    const now = Date.now();
    let record = this.floodMap.get(key);

    if (!record) {
      record = { timestamps: [], cooldownUntil: 0 };
      this.floodMap.set(key, record);
    }

    // 1. Si está en enfriamiento (cooldown)
    if (record.cooldownUntil && now < record.cooldownUntil) {
      const remainingSeconds = Math.ceil((record.cooldownUntil - now) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      return {
        allowed: false,
        onCooldown: true,
        remainingSeconds,
        remainingMinutes,
      };
    }

    // 2. Limpiar timestamps más antiguos que 2 minutos (120,000 ms)
    record.timestamps = record.timestamps.filter((ts) => now - ts < 120000);

    // 3. Si ha superado el umbral (>= 3 intentos en menos de 2 minutos)
    if (record.timestamps.length >= 3) {
      record.cooldownUntil = now + 10 * 60 * 1000; // 10 minutos de enfriamiento
      record.timestamps = []; // resetear ráfaga
      return {
        allowed: false,
        triggeredCooldown: true,
        cooldownMinutes: 10,
      };
    }

    return { allowed: true };
  }

  recordKeyBurst(userId, guildId) {
    const gId = guildId || this.primaryGuildId;
    const key = `${gId}:${userId}`;
    let record = this.floodMap.get(key);
    if (!record) {
      record = { timestamps: [], cooldownUntil: 0 };
      this.floodMap.set(key, record);
    }
    record.timestamps.push(Date.now());
  }

  // ── FORMATO DE PLANTILLA DE ENTREGA PERSONALIZABLE ──

  formatForwardTemplate({ providerName, keyOrUser, days, isAccount = false, guildId = null }) {
    const gData = this.getGuildData(guildId);
    const tmpl = gData.customTemplate || {};
    const storeName = tmpl.storeName ? `⭐ ${tmpl.storeName.toUpperCase()} ⭐\n` : '';
    const noteText = tmpl.noteText || 'Válida para 1 solo dispositivo.';
    const footerText = tmpl.footerText ? `\n💬 ${tmpl.footerText}` : '';

    if (isAccount) {
      const [uname, pass] = String(keyOrUser).includes(':') ? String(keyOrUser).split(':') : [keyOrUser, '1'];
      return (
        '```text\n' +
        storeName +
        `👤 Usuario: ${uname}\n` +
        `🔑 Contraseña: ${pass}\n` +
        `⏳ Duración: ${days} Días\n` +
        `📱 Plataforma: ${providerName}\n` +
        `⚠️ Nota: ${noteText}` +
        footerText +
        '\n```'
      );
    }

    return (
      '```text\n' +
      storeName +
      `🔑 Clave: ${keyOrUser}\n` +
      `⏳ Duración: ${days} Días\n` +
      `📱 Plataforma: ${providerName}\n` +
      `⚠️ Nota: ${noteText}` +
      footerText +
      '\n```'
    );
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
        dailyLimit: reseller.dailyLimit || 0,
        usedToday: reseller.usedToday || 0,
        remainingToday: reseller.remainingToday,
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
        dailyLimit: 0,
        usedToday: 0,
        remainingToday: null,
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
      dailyLimit: 0,
      usedToday: 0,
      remainingToday: 0,
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
      setReseller: (userId, days, allowedProviders, addedBy, dailyLimit) => this.setReseller(userId, days, allowedProviders, addedBy, dailyLimit, gId),
      removeReseller: (userId) => this.removeReseller(userId, gId),
      getAllResellers: () => this.getAllResellers(gId),
      getUserPermissions: (member, cfg) => this.getUserPermissions(member, cfg, gId),
      checkResellerQuota: (userId, count) => this.checkResellerQuota(userId, count, gId),
      incrementResellerUsage: (userId, count) => this.incrementResellerUsage(userId, count, gId),
      checkAntiFlood: (userId) => this.checkAntiFlood(userId, gId),
      recordKeyBurst: (userId) => this.recordKeyBurst(userId, gId),
      formatForwardTemplate: (params) => this.formatForwardTemplate({ ...params, guildId: gId }),
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
