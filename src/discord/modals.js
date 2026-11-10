const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

function getCreateKeyModal(providerId = 'bypass', maxDays = 30) {
  // Modal específico para KeyAuth (Elite Pro): Funciona por stock precargado
  if (providerId === 'keyauth') {
    const modal = new ModalBuilder()
      .setCustomId('modal_create_keyauth')
      .setTitle('🔑 Reclamar KeyAuth (Elite Pro)');

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
      new ActionRowBuilder().addComponents(countInput),
      new ActionRowBuilder().addComponents(noteInput)
    );

    return modal;
  }

  const isUserAccount = providerId === 'mycheats';
  const isUid = providerId === 'bypass_uid';

  let title = '⚡ Crear Licencia Bypass APK';
  if (isUserAccount) title = '👤 Crear Usuario (WorldCheats Panel VIP)';
  if (isUid) title = '🛡️ Crear Licencia Bypass UID (Auto ON)';
  if (providerId === 'keyauth') title = '🔑 Crear Licencia KeyAuth (Elite Pro)';

  const modal = new ModalBuilder()
    .setCustomId(`modal_create_${providerId}`)
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

  const prefixLabel = isUserAccount
    ? 'Prefijo o Nombre de Usuario (Contraseña: 1)'
    : 'Prefijo de la Key (Opcional)';

  const prefixPlaceholder = isUserAccount
    ? 'Ej: Juan, VIP, Cliente (se creará Juan_1234)'
    : 'Ejemplo: VIP, ELITE, PRO';

  const prefixInput = new TextInputBuilder()
    .setCustomId('input_prefix')
    .setLabel(prefixLabel)
    .setPlaceholder(prefixPlaceholder)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(15)
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
    new ActionRowBuilder().addComponents(prefixInput),
    new ActionRowBuilder().addComponents(noteInput)
  );

  return modal;
}

function getDeleteKeyModal(providerId = 'bypass') {
  const isUserAccount = providerId === 'mycheats';
  const modal = new ModalBuilder()
    .setCustomId(`modal_delete_${providerId}`)
    .setTitle(isUserAccount ? '🗑️ Eliminar Usuario' : '🗑️ Revocar Licencia');

  const keyInput = new TextInputBuilder()
    .setCustomId('input_key')
    .setLabel(isUserAccount ? 'Nombre de Usuario a eliminar *' : 'License Key a eliminar *')
    .setPlaceholder(isUserAccount ? 'Ej: VIP_1234' : 'KEY-XXXXXX')
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
  return modal;
}

function getResetHwidModal(providerId = 'bypass') {
  const isUserAccount = providerId === 'mycheats';
  const modal = new ModalBuilder()
    .setCustomId(`modal_reset_${providerId}`)
    .setTitle('🔄 Resetear HWID');

  const keyInput = new TextInputBuilder()
    .setCustomId('input_key')
    .setLabel(isUserAccount ? 'Nombre de Usuario a resetear HWID *' : 'License Key a resetear *')
    .setPlaceholder(isUserAccount ? 'Ej: VIP_1234' : 'KEY-XXXXXX')
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
  return modal;
}

module.exports = {
  getCreateKeyModal,
  getDeleteKeyModal,
  getResetHwidModal,
};
