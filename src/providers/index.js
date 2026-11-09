const BypassProvider = require('./BypassProvider');
const BypassUidProvider = require('./BypassUidProvider');
const MyCheatsProvider = require('./MyCheatsProvider');
const KeyAuthProvider = require('./KeyAuthProvider');
const config = require('../config');

class ProviderManager {
  constructor() {
    this.providers = new Map();
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

  list() {
    return Array.from(this.providers.values());
  }

  register(id, providerInstance) {
    this.providers.set(id, providerInstance);
  }
}

module.exports = new ProviderManager();
