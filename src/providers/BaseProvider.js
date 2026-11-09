class BaseProvider {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;
  }

  /**
   * Autenticación o inicio de sesión
   */
  async login() {
    throw new Error('Method login() must be implemented');
  }

  /**
   * Generar una o varias keys
   * @param {Object} options
   * @param {number} options.days - Duración en días
   * @param {number} [options.count=1] - Cantidad de keys (1-5)
   * @param {string} [options.prefix] - Prefijo opcional
   * @param {string} [options.note] - Nota opcional
   * @returns {Promise<string[]>} Lista de keys generadas
   */
  async createKey(options) {
    throw new Error('Method createKey() must be implemented');
  }

  /**
   * Eliminar una key
   * @param {string} key
   */
  async deleteKey(key) {
    throw new Error('Method deleteKey() must be implemented');
  }

  /**
   * Resetear HWID de una key
   * @param {string} key
   */
  async resetHwid(key) {
    throw new Error('Method resetHwid() must be implemented');
  }

  /**
   * Obtener lista de keys del proveedor (si el proveedor lo soporta)
   */
  async listKeys() {
    return [];
  }
}

module.exports = BaseProvider;
