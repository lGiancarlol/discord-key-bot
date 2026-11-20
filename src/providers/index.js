const BypassProvider = require('./BypassProvider');
const BypassUidProvider = require('./BypassUidProvider');
const MyCheatsProvider = require('./MyCheatsProvider');
const KeyAuthProvider = require('./KeyAuthProvider');
const RealAuthXProvider = require('./RealAuthXProvider');
const config = require('../config');

function getBaseProviderType(id) {
  if (!id) return 'bypass';
  if (id === 'mycheats' || id.startsWith('mycheats_')) return 'mycheats';
  if (id === 'realauthx' || id.startsWith('realauthx_')) return 'realauthx';
  if (id === 'bypass_uid' || id.startsWith('bypass_uid_')) return 'bypass_uid';
  if (id === 'bypass' || id.startsWith('bypass_')) return 'bypass';
  if (id === 'keyauth' || id.startsWith('keyauth_')) return 'keyauth';
  return id;
}

class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.guildProviders = new Map();
    this.init();
  }

  getBaseType(id) {
    return getBaseProviderType(id);
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
    if (config.providers.realauthx) {
      this.providers.set('realauthx', new RealAuthXProvider(config.providers.realauthx));
    }
  }

  get(id) {
    return this.providers.get(id);
  }

  // Obtener proveedor configurado para una guild específica
  getForGuild(id, guildId, db = null) {
    if (!guildId) return this.get(id);

    const baseType = getBaseProviderType(id);

    // Revisar si la guild tiene configuración personalizada para este proveedor
    let customCfg = null;
    if (db) {
      const gConfig = db.getGuildConfig(guildId);
      customCfg = gConfig?.providersConfig?.[id] || (id !== baseType ? gConfig?.providersConfig?.[baseType] : null);
    }

    // Determinar si hay configuración personalizada activa y válida
    const hasCustomUser = Boolean(customCfg?.username && String(customCfg.username).trim());
    const hasCustomKey = Boolean(customCfg?.sellerKey && String(customCfg.sellerKey).trim());
    const hasCustomUrl = Boolean(customCfg?.baseUrl && String(customCfg.baseUrl).trim());
    const hasExplicitDisabled = customCfg?.enabled === false;

    const hasCustomSettings = hasCustomUser || hasCustomKey || hasCustomUrl || hasExplicitDisabled;

    if (!hasCustomSettings && id === baseType) {
      return this.get(id);
    }

    const cacheKey = `${guildId}_${id}`;
    if (this.guildProviders.has(cacheKey)) {
      return this.guildProviders.get(cacheKey);
    }

    const baseConfig = config.providers[baseType] || config.providers[id] || {};
    const mergedConfig = {
      ...baseConfig,
      ...customCfg,
      id,
      baseUrl: (customCfg?.baseUrl && String(customCfg.baseUrl).trim()) || baseConfig.baseUrl,
      username: hasCustomUser ? String(customCfg.username).trim() : baseConfig.username,
      password: (customCfg?.password && String(customCfg.password).trim()) || baseConfig.password,
      sellerKey: hasCustomKey ? String(customCfg.sellerKey).trim() : baseConfig.sellerKey,
      appId: (customCfg?.appId && String(customCfg.appId).trim()) || baseConfig.appId,
      defaultSubId: (customCfg?.defaultSubId && String(customCfg.defaultSubId).trim()) || baseConfig.defaultSubId,
    };

    let instance = null;
    if (baseType === 'bypass') instance = new BypassProvider(mergedConfig);
    else if (baseType === 'bypass_uid') instance = new BypassUidProvider(mergedConfig);
    else if (baseType === 'mycheats') instance = new MyCheatsProvider(mergedConfig);
    else if (baseType === 'keyauth') instance = new KeyAuthProvider(mergedConfig);
    else if (baseType === 'realauthx') instance = new RealAuthXProvider(mergedConfig);
    else instance = this.get(id);

    if (instance) {
      instance.guildId = guildId;
      instance.db = db;
      instance.providerId = id;
      console.log(`[ProviderManager] ⚡ Proveedor exclusivo activado para guild ${guildId} (${id} -> ${baseType}): usuario="${mergedConfig.username || 'KeyAuth'}" appId="${mergedConfig.appId || 'N/A'}"`);
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
    const enabledList = (guildId && db && typeof db.getEnabledProviders === 'function')
      ? db.getEnabledProviders(guildId)
      : ['bypass', 'bypass_uid', 'mycheats', 'keyauth', 'realauthx'];

    const results = {};
    for (const pId of enabledList) {
      const customName = (guildId && db && typeof db.getProviderMetadata === 'function')
        ? db.getProviderMetadata(guildId, pId)?.name
        : null;
      const displayName = customName && customName.trim() ? customName.trim() : pId;

      const p = this.getForGuild(pId, guildId, db);
      if (p && typeof p.checkHealth === 'function') {
        try {
          const res = await p.checkHealth();
          results[pId] = { name: displayName, ...res };
        } catch (err) {
          results[pId] = { name: displayName, online: false, error: err.message };
        }
      } else {
        results[pId] = { name: displayName, online: true, message: 'Operativo' };
      }
    }
    return results;
  }

  startKeepAlive(intervalMinutes = 25, db = null) {
    if (this._keepAliveInterval) {
      clearInterval(this._keepAliveInterval);
    }

    const intervalMs = Math.max(10, intervalMinutes) * 60 * 1000;
    console.log(`[ProviderManager] 💓 Proceso Keep-Alive de sesiones iniciado (frecuencia: cada ${intervalMinutes} min).`);

    this._keepAliveInterval = setInterval(async () => {
      try {
        console.log(`[Keep-Alive] 💓 Comprobando salud y renovando sesiones de plataformas activas...`);
        // 1. Proveedores globales por defecto
        for (const [id, provider] of this.providers.entries()) {
          if (provider && typeof provider.checkHealth === 'function') {
            try {
              const res = await provider.checkHealth();
              if (res.online) {
                console.log(`[Keep-Alive] ✅ ${id} activo (${res.latency || 0}ms)`);
              } else {
                console.warn(`[Keep-Alive] ⚠️ ${id} reportó inactividad: ${res.error || res.message}`);
              }
            } catch (pErr) {
              console.warn(`[Keep-Alive] ⚠️ Error en ping de ${id}: ${pErr.message}`);
            }
          }
        }

        // 2. Proveedores exclusivos por servidor
        for (const [cacheKey, provider] of this.guildProviders.entries()) {
          if (provider && typeof provider.checkHealth === 'function') {
            try {
              const res = await provider.checkHealth();
              if (res.online) {
                console.log(`[Keep-Alive] ✅ Servidor ${cacheKey} activo (${res.latency || 0}ms)`);
              } else {
                console.warn(`[Keep-Alive] ⚠️ Servidor ${cacheKey} sesión inactiva: ${res.error || res.message}`);
              }
            } catch (gpErr) {
              console.warn(`[Keep-Alive] ⚠️ Error en ping de ${cacheKey}: ${gpErr.message}`);
            }
          }
        }
      } catch (err) {
        console.error('[Keep-Alive] Error en ciclo de mantenimiento de sesiones:', err.message);
      }
    }, intervalMs);

    if (this._keepAliveInterval.unref) this._keepAliveInterval.unref();
  }
}

module.exports = new ProviderManager();
