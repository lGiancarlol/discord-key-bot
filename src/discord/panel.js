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

// Panel de Control Exclusivo para Administradores
function createAdminPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f) // Dorado VIP
    .setTitle('👑 PANEL DE CONTROL ADMINISTRATIVO')
    .setDescription(
      '```ansi\n\u001b[1;33m★ CENTRO DE CONTROL & GESTIÓN DE REVENDEDORES\u001b[0m\n```\n' +
        'Bienvenido al panel central de administración. Puedes gestionar revendedores, stock y permisos usando los botones directos sin necesidad de escribir comandos manuales.\n\n' +
        '╭─ **ACCIONES DISPONIBLES** ────────────────╮\n' +
        '│ 👤 **Asignar Revendedor**  ▸ Dar tiempo y páginas\n' +
        '│ ❌ **Quitar Revendedor**   ▸ Revocar acceso total\n' +
        '│ 🔍 **Info Revendedor**     ▸ Consultar días restantes\n' +
        '│ 📦 **Cargar Stock**        ▸ Lote de keys para KeyAuth\n' +
        '│ 📊 **Estado & Stock**      ▸ Ver inventario de claves\n' +
        '│ 📋 **Lista General**       ▸ Todos los revendedores\n' +
        '╰───────────────────────────────────────────╯\n' +
        '⚠️ *Panel restringido: Solo Administradores del Bot pueden interactuar.*'
    )
    .setFooter({
      text: 'Gestión Administrativa • Desarrollado por Gian',
    })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_btn_assign_reseller')
      .setLabel('Asignar Revendedor')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('admin_btn_remove_reseller')
      .setLabel('Quitar Revendedor')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('admin_btn_info_reseller')
      .setLabel('Consultar Revendedor')
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_btn_add_stock')
      .setLabel('Cargar Stock (KeyAuth)')
      .setEmoji('📦')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('admin_btn_view_stock')
      .setLabel('Ver Stock & Estado')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('admin_btn_list_resellers')
      .setLabel('Lista de Revendedores')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

module.exports = { createPanelPayload, createAdminPanelPayload };
