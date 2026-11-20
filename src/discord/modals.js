const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

function getCreateKeyModal(providerId = 'bypass', maxDays = 30, defaultPrefix = '', subId = '', subName = '', customName = '', appName = '') {
  // Modal específico para KeyAuth (Elite Pro): Funciona por stock precargado
  if (providerId === 'keyauth' || providerId.startsWith('keyauth_')) {
    const modalCustomId = appName ? `modal_create_keyauth_${encodeURIComponent(appName)}` : `modal_create_${providerId}`;
    const modal = new ModalBuilder()
      .setCustomId(modalCustomId)
      .setTitle(`🔑 Reclamar ${customName || (appName ? `KeyAuth (${appName})` : 'KeyAuth (Elite Pro)')}`.slice(0, 45));

    const daysInput = new TextInputBuilder()
      .setCustomId('input_days')
      .setLabel(`Duración de la Key en Días *`)
      .setPlaceholder(`Ej: 1, 7, 15, 30 (según stock cargado)`)
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(3)
      .setRequired(true);

    const countInput = new TextInputBuilder()
      .setCustomId('input_count')
      .setLabel('Cantidad de Keys (1 a 5)')
      .setPlaceholder('1 a 5 (deja en blanco para 1)')
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(1)
      .setRequired(false);

    const noteInput = new TextInputBuilder()
      .setCustomId('input_note')
      .setLabel('Nota / Cliente / Observación (Opcional)')
      .setPlaceholder('Ejemplo: Cliente Discord Juan')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(50)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(daysInput),
      new ActionRowBuilder().addComponents(countInput),
      new ActionRowBuilder().addComponents(noteInput)
    );

    return modal;
  }

  const isUserAccount = providerId === 'mycheats' || providerId.startsWith('mycheats_');
  const isUid = providerId === 'bypass_uid' || providerId.startsWith('bypass_uid_');
  const isRealAuthX = providerId === 'realauthx' || providerId.startsWith('realauthx_');

  let title = customName ? `⚡ Crear ${customName}`.slice(0, 45) : '⚡ Crear Licencia Bypass APK';
  let modalCustomId = `modal_create_${providerId}`;

  if (isUserAccount) {
    title = subName ? `👤 ${subName}`.slice(0, 45) : `👤 Crear ${customName || 'Usuario (VIP)'}`.slice(0, 45);
    if (subId) modalCustomId = `modal_create_${providerId}_${subId}`;
  }
  if (isUid) title = customName ? `🛡️ Crear ${customName}`.slice(0, 45) : '🛡️ Crear Licencia Bypass UID (Auto ON)';
  if (isRealAuthX) {
    title = subName ? `🎮 ${subName}`.slice(0, 45) : `🎮 Crear ${customName || 'RealAuthX'}`.slice(0, 45);
    if (subId) modalCustomId = `modal_create_${providerId}_${subId}`;
  }

  const modal = new ModalBuilder()
    .setCustomId(modalCustomId)
    .setTitle(title);

  const daysLabel = isUid
    ? `Duración en Días (1, 7, 15, 30, 60, 90) *`
    : `Duración en Días (Máximo ${maxDays} días) *`;

  const daysInput = new TextInputBuilder()
    .setCustomId('input_days')
    .setLabel(daysLabel)
    .setPlaceholder(`Ej: 1, 15, 30`)
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(3)
    .setRequired(true);

  const countInput = new TextInputBuilder()
    .setCustomId('input_count')
    .setLabel(isUserAccount ? 'Cantidad de Cuentas (Máx. 5)' : 'Cantidad de Keys (Máx. 5)')
    .setPlaceholder('1 a 5 (deja en blanco para 1)')
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(1)
    .setRequired(false);

  const isBypass = providerId.startsWith('bypass');

  const prefixLabel = isUserAccount
    ? 'Prefijo o Nombre de Usuario (Contraseña: 1)'
    : isBypass
    ? 'Prefijo (Dejar vacío para formato original)'
    : 'Prefijo de la Key (Opcional)';

  const prefixPlaceholder = isUserAccount
    ? 'Ej: Juan, VIP, Cliente (se creará Juan_1234)'
    : isBypass
    ? (isUid ? 'Por defecto de la página: UID-XXXX-...' : 'Por defecto de la página: BYPASS-XXXX-...')
    : 'Ejemplo: VIP, ELITE, PRO';

  const prefixInput = new TextInputBuilder()
    .setCustomId('input_prefix')
    .setLabel(prefixLabel)
    .setPlaceholder(prefixPlaceholder)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(15)
    .setRequired(false);

  if (defaultPrefix && !isBypass) {
    prefixInput.setValue(String(defaultPrefix).trim());
  }

  const noteInput = new TextInputBuilder()
    .setCustomId('input_note')
    .setLabel('Nota / Cliente / Observación (Opcional)')
    .setPlaceholder('Ejemplo: Cliente Discord Juan')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(50)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(daysInput),
    new ActionRowBuilder().addComponents(countInput),
    new ActionRowBuilder().addComponents(prefixInput),
    new ActionRowBuilder().addComponents(noteInput)
  );

  return modal;
}

function getDeleteKeyModal(providerId = 'bypass', customName = '') {
  const isUserAccount = providerId === 'mycheats' || providerId.startsWith('mycheats_');
  const label = customName ? ` (${customName})` : '';
  const modal = new ModalBuilder()
    .setCustomId(`modal_delete_${providerId}`)
    .setTitle(isUserAccount ? `🗑️ Eliminar Usuario${label}`.slice(0, 45) : `🗑️ Revocar Licencia${label}`.slice(0, 45));

  const keyInput = new TextInputBuilder()
    .setCustomId('input_key')
    .setLabel(isUserAccount ? `Usuario de ${customName || 'la plataforma'} a eliminar *`.slice(0, 45) : `License Key de ${customName || 'la plataforma'} *`.slice(0, 45))
    .setPlaceholder(isUserAccount ? 'Ej: VIP_1234' : 'KEY-XXXXXX')
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
  return modal;
}

function getResetHwidModal(providerId = 'bypass', customName = '') {
  const isUserAccount = providerId === 'mycheats' || providerId.startsWith('mycheats_');
  const label = customName ? ` (${customName})` : '';
  const modal = new ModalBuilder()
    .setCustomId(`modal_reset_${providerId}`)
    .setTitle(`🔄 Resetear HWID${label}`.slice(0, 45));

  const keyInput = new TextInputBuilder()
    .setCustomId('input_key')
    .setLabel(isUserAccount ? `Usuario de ${customName || 'la plataforma'} a resetear *`.slice(0, 45) : `License Key de ${customName || 'la plataforma'} *`.slice(0, 45))
    .setPlaceholder(isUserAccount ? 'Ej: VIP_1234' : 'KEY-XXXXXX')
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
  return modal;
}

// ── MODALES EXCLUSIVOS DEL PANEL ADMINISTRATIVO ──

function getAdminAssignResellerModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_admin_assign_reseller')
    .setTitle('👤 Asignar o Renovar Revendedor');

  const userInput = new TextInputBuilder()
    .setCustomId('input_admin_target_user')
    .setLabel('ID o @Mención del Usuario *')
    .setPlaceholder('Ej: 123456789012345678 o @usuario')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const daysInput = new TextInputBuilder()
    .setCustomId('input_admin_reseller_days')
    .setLabel('Días de Membresía *')
    .setPlaceholder('Ej: 30 (o 15, 60, etc.)')
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(4)
    .setRequired(true);

  const limitInput = new TextInputBuilder()
    .setCustomId('input_admin_reseller_limit')
    .setLabel('Límite Diario de Keys (0 = ilimitado)')
    .setPlaceholder('Ej: 20 (opcional, vacío o 0 = ilimitado)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput),
    new ActionRowBuilder().addComponents(daysInput),
    new ActionRowBuilder().addComponents(limitInput)
  );

  return modal;
}

function getAdminEditPermsModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_admin_edit_perms')
    .setTitle('🔐 Modificar Permisos de Revendedor');

  const userInput = new TextInputBuilder()
    .setCustomId('input_admin_target_user')
    .setLabel('ID o @Mención del Revendedor *')
    .setPlaceholder('Ej: 123456789012345678 o @usuario')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(userInput));
  return modal;
}

function getAdminRemoveResellerModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_admin_remove_reseller')
    .setTitle('❌ Quitar Revendedor');

  const userInput = new TextInputBuilder()
    .setCustomId('input_admin_target_user')
    .setLabel('ID o @Mención del Usuario a remover *')
    .setPlaceholder('Ej: 123456789012345678 o @usuario')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(userInput));
  return modal;
}

function getAdminInfoResellerModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_admin_info_reseller')
    .setTitle('🔍 Consultar Estado de Revendedor');

  const userInput = new TextInputBuilder()
    .setCustomId('input_admin_target_user')
    .setLabel('ID o @Mención del Usuario a consultar *')
    .setPlaceholder('Ej: 123456789012345678 o @usuario')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(userInput));
  return modal;
}

function getAdminAddStockModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_admin_add_stock')
    .setTitle('📦 Cargar Lote de Claves al Stock');

  const providerInput = new TextInputBuilder()
    .setCustomId('input_admin_stock_provider')
    .setLabel('Plataforma (KeyAuth Elite Pro)')
    .setValue('keyauth')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const daysInput = new TextInputBuilder()
    .setCustomId('input_admin_stock_days')
    .setLabel('Duración en Días (Ej: 1, 7, 30) *')
    .setPlaceholder('30 (por defecto 30 días)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const keysInput = new TextInputBuilder()
    .setCustomId('input_admin_stock_keys')
    .setLabel('Lista de Claves (espacio o por línea) *')
    .setPlaceholder('TRYHARD-XXXX-YYYY\nTRYHARD-AAAA-BBBB')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(providerInput),
    new ActionRowBuilder().addComponents(daysInput),
    new ActionRowBuilder().addComponents(keysInput)
  );

  return modal;
}

module.exports = {
  getCreateKeyModal,
  getDeleteKeyModal,
  getResetHwidModal,
  getAdminAssignResellerModal,
  getAdminEditPermsModal,
  getAdminRemoveResellerModal,
  getAdminInfoResellerModal,
  getAdminAddStockModal,
};
