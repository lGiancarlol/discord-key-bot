/**
 * Censura claves de licencia o cuentas para su envío seguro al canal de logs de Discord.
 * Oculta los bloques sensibles manteniendo sólo el prefijo y los últimos 2 caracteres verificadores.
 * En la web y respuestas privadas de Discord, las keys permanecen completas.
 *
 * Ejemplos:
 *   BYPASS-A3PU-9ZA9-VXZJ -> `BYPASS-****-****-**ZJ`
 *   UID-Y2VF-TCZS-P5MF    -> `UID-****-****-**MF`
 *   User_1234:1           -> `Use****:*`
 *   KEY-123456           -> `KEY-1****6`
 */
function censorKey(rawItem) {
  const keyValue =
    typeof rawItem === 'object' && rawItem !== null
      ? (rawItem.username ? `${rawItem.username}:1` : (rawItem.key || rawItem.license_key || ''))
      : rawItem;

  if (!keyValue || typeof keyValue !== 'string') return '`****`';
  const str = keyValue.trim();

  // Formato usuario:contraseña (MyCheats)
  if (str.includes(':')) {
    const [u] = str.split(':');
    const uPrefix = u.length > 4 ? u.slice(0, 3) : u.slice(0, 1);
    return `\`${uPrefix}****:*\``;
  }

  // Formato estándar con guiones (ej: BYPASS-XXXX-XXXX-XXXX o UID-XXXX-XXXX-XXXX)
  const parts = str.split('-');
  if (parts.length >= 3) {
    const prefix = parts[0];
    const last = parts[parts.length - 1];
    const maskedMiddle = parts.slice(1, -1).map(() => '****').join('-');
    const lastMasked = last.length > 2 ? `**${last.slice(-2)}` : '****';
    return `\`${prefix}-${maskedMiddle}-${lastMasked}\``;
  }

  if (parts.length === 2) {
    const prefix = parts[0];
    const last = parts[1];
    const lastMasked = last.length > 3 ? `${last.slice(0, 1)}****${last.slice(-1)}` : '****';
    return `\`${prefix}-${lastMasked}\``;
  }

  // Clave simple sin guiones
  if (str.length <= 6) return '`******`';
  return `\`${str.slice(0, 2)}****${str.slice(-2)}\``;
}

module.exports = {
  censorKey,
};
