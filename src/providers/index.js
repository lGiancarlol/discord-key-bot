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

    // Si no hay configuración personalizada o está vacía, usar el proveedor por defecto
    const hasCustomSettings =
      customCfg &&
      (customCfg.baseUrl || customCfg.username || customCfg.sellerKey || customCfg.enabled === false);

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
      baseUrl: customCfg.baseUrl || baseConfig.baseUrl,
      username: customCfg.username || baseConfig.username,
      password: customCfg.password || baseConfig.password,
      sellerKey: customCfg.sellerKey || baseConfig.sellerKey,
      appId: customCfg.appId || baseConfig.appId,
      defaultSubId: customCfg.defaultSubId || baseConfig.defaultSubId,
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
}

module.exports = new ProviderManager();
