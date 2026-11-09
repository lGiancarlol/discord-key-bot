const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

function createPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x00d2d3) // Cian luminoso
    .setTitle('🛡️ SISTEMA DE LICENCIAS & ACCESOS')
    .setDescription(
      '```ansi\n\u001b[1;36m● SISTEMA OPERATIVO & EN LÍNEA (AUTH API v2.4)\u001b[0m\n```\n' +
        'Bienvenido al portal interactivo de administración y distribución de licencias.\n' +
        'Utiliza los controles inferiores para emitir y gestionar tus accesos de forma instantánea y segura.\n\n' +
        '╭─ **PLATAFORMAS DISPONIBLES** ───────────╮\n' +
        '│ ⚡ **Bypass APK**              ▸ Emisión de licencias\n' +
        '│ 🛡️ **Bypass UID (Auto ON)**    ▸ Licencias con UID ON\n' +
        '│ 👤 **WorldCheats (Panel VIP)** ▸ Cuentas de usuario\n' +
        '│ 🔑 **KeyAuth (Elite Pro)**     ▸ Licencias oficiales\n' +
        '╰─────────────────────────────────────────╯'
    )
    .setFooter({
      text: 'Desarrollado por Gian • Auth Cloud Gateway',
    })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_create_key')
      .setLabel('Generar Key')
      .setEmoji('🔑')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_delete_key')
      .setLabel('Eliminar Key')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('btn_reset_hwid')
      .setLabel('Reset HWID')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_my_keys')
      .setLabel('Mis Licencias')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_my_membership')
      .setLabel('Mi Membresía')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

module.exports = { createPanelPayload };
