const BypassProvider = require('./BypassProvider');
const BypassUidProvider = require('./BypassUidProvider');
const MyCheatsProvider = require('./MyCheatsProvider');
const KeyAuthProvider = require('./KeyAuthProvider');
const config = require('../config');

class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.guildProviders = new Map();
    this.init();
  }

  init() {
    if (config.providers.bypass) {
      this.providers.set('bypass', new BypassProvider(config.providers.bypass));
    }
    if (config.providers.bypass_uid) {
      this.providers.set('bypass_uid', new BypassUidProvider(config.providers.bypass_uid));
    }
    if (config.providers.mycheats) {
      this.providers.set('mycheats', new MyCheatsProvider(config.providers.mycheats));
    }
    if (config.providers.keyauth) {
      this.providers.set('keyauth', new KeyAuthProvider(config.providers.keyauth));
    }
  }

  get(id) {
    return this.providers.get(id);
  }

  // Obtener proveedor configurado para una guild específica
  getForGuild(id, guildId, db = null) {
    if (!guildId) return this.get(id);

    // Revisar si la guild tiene configuración personalizada para este proveedor
    let customCfg = null;
    if (db) {
      const gConfig = db.getGuildConfig(guildId);
      customCfg = gConfig?.providersConfig?.[id];
    }

    // Determinar si hay configuración personalizada activa y válida
    const hasCustomUser = Boolean(customCfg?.username && String(customCfg.username).trim());
    const hasCustomKey = Boolean(customCfg?.sellerKey && String(customCfg.sellerKey).trim());
    const hasCustomUrl = Boolean(customCfg?.baseUrl && String(customCfg.baseUrl).trim());
    const hasExplicitDisabled = customCfg?.enabled === false;

    const hasCustomSettings = hasCustomUser || hasCustomKey || hasCustomUrl || hasExplicitDisabled;

    if (!hasCustomSettings) {
      return this.get(id);
    }

    const cacheKey = `${guildId}_${id}`;
    if (this.guildProviders.has(cacheKey)) {
      return this.guildProviders.get(cacheKey);
    }

    const baseConfig = config.providers[id] || {};
    const mergedConfig = {
      ...baseConfig,
      ...customCfg,
      id,
      baseUrl: (customCfg.baseUrl && String(customCfg.baseUrl).trim()) || baseConfig.baseUrl,
      username: hasCustomUser ? String(customCfg.username).trim() : baseConfig.username,
      password: (customCfg.password && String(customCfg.password).trim()) || baseConfig.password,
      sellerKey: hasCustomKey ? String(customCfg.sellerKey).trim() : baseConfig.sellerKey,
      appId: (customCfg.appId && String(customCfg.appId).trim()) || baseConfig.appId,
      defaultSubId: (customCfg.defaultSubId && String(customCfg.defaultSubId).trim()) || baseConfig.defaultSubId,
    };

    let instance = null;
    if (id === 'bypass') instance = new BypassProvider(mergedConfig);
    else if (id === 'bypass_uid') instance = new BypassUidProvider(mergedConfig);
    else if (id === 'mycheats') instance = new MyCheatsProvider(mergedConfig);
    else if (id === 'keyauth') instance = new KeyAuthProvider(mergedConfig);
    else instance = this.get(id);

    if (instance) {
      instance.guildId = guildId;
      instance.db = db;
      console.log(`[ProviderManager] ⚡ Proveedor exclusivo activado para guild ${guildId} (${id}): usuario="${mergedConfig.username || 'KeyAuth'}" appId="${mergedConfig.appId || 'N/A'}"`);
    }

    this.guildProviders.set(cacheKey, instance);
    return instance;
  }

  invalidateGuild(guildId) {
    for (const key of this.guildProviders.keys()) {
      if (key.startsWith(`${guildId}_`)) {
        this.guildProviders.delete(key);
      }
    }
  }

  list() {
    return Array.from(this.providers.values());
  }

  register(id, providerInstance) {
    this.providers.set(id, providerInstance);
  }

  async checkAllHealth(guildId = null, db = null) {
    const targets = [
      { id: 'bypass', name: 'Bypass APK (172.96.172.132)' },
      { id: 'mycheats', name: 'WorldCheats (new.mycheats.net)' },
      { id: 'keyauth', name: 'KeyAuth (Elite Pro)' },
    ];

    const results = {};
    for (const t of targets) {
      const p = this.getForGuild(t.id, guildId, db);
      if (p && typeof p.checkHealth === 'function') {
        try {
          const res = await p.checkHealth();
          results[t.id] = { name: t.name, ...res };
        } catch (err) {
          results[t.id] = { name: t.name, online: false, error: err.message };
        }
      } else {
        results[t.id] = { name: t.name, online: true, message: 'Operativo' };
      }
    }
    return results;
  }
}

module.exports = new ProviderManager();
