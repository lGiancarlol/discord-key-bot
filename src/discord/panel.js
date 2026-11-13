const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const PROVIDER_METADATA = {
  bypass: { name: 'Bypass APK', desc: 'Emisión de licencias', icon: '⚡' },
  bypass_uid: { name: 'Bypass UID (Auto ON)', desc: 'Licencias con UID ON', icon: '🛡️' },
  mycheats: { name: 'WorldCheats (Panel VIP)', desc: 'Cuentas de usuario', icon: '👤' },
  keyauth: { name: 'KeyAuth (Elite Pro)', desc: 'Licencias oficiales', icon: '🔑' },
};

function createPanelPayload(guildId = null, db = null) {
  let enabled = ['bypass', 'bypass_uid', 'mycheats', 'keyauth'];
  let embedColor = 0x00d2d3; // Cian luminoso por defecto

  if (guildId && db) {
    if (typeof db.getEnabledProviders === 'function') {
      enabled = db.getEnabledProviders(guildId);
    }
    const cfg = db.getGuildConfig ? db.getGuildConfig(guildId) : null;
    if (cfg?.branding?.embedColor) {
      const parsedColor = parseInt(cfg.branding.embedColor.replace('#', ''), 16);
      if (!isNaN(parsedColor)) embedColor = parsedColor;
    }
  }

  const platformLines = enabled
    .map((pid) => {
      const meta = PROVIDER_METADATA[pid];
      if (!meta) return null;
      return `│ ${meta.icon} **${meta.name}** ▸ ${meta.desc}`;
    })
    .filter(Boolean);

  const platformBox = platformLines.length > 0
    ? '╭─ **PLATAFORMAS DISPONIBLES** ───────────╮\n' +
      platformLines.join('\n') + '\n' +
      '╰─────────────────────────────────────────╯'
    : '*(No hay plataformas habilitadas para este servidor aún)*';

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle('🛡️ SISTEMA DE LICENCIAS & ACCESOS')
    .setDescription(
      '```ansi\n\u001b[1;36m● SISTEMA OPERATIVO & EN LÍNEA (AUTH API v2.4)\u001b[0m\n```\n' +
        'Bienvenido al portal interactivo de administración y distribución de licencias.\n' +
        'Utiliza los controles inferiores para emitir y gestionar tus accesos de forma instantánea y segura.\n\n' +
        platformBox
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
function createAdminPanelPayload(guildId = null, db = null) {
  let embedColor = 0xf1c40f; // Dorado VIP por defecto

  if (guildId && db) {
    const cfg = db.getGuildConfig ? db.getGuildConfig(guildId) : null;
    if (cfg?.branding?.embedColor) {
      const parsedColor = parseInt(cfg.branding.embedColor.replace('#', ''), 16);
      if (!isNaN(parsedColor)) embedColor = parsedColor;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle('👑 PANEL DE CONTROL ADMINISTRATIVO')
    .setDescription(
      '```ansi\n\u001b[1;33m★ CENTRO DE CONTROL & GESTIÓN DE REVENDEDORES\u001b[0m\n```\n' +
        'Bienvenido al panel central de administración. Puedes gestionar revendedores, stock y permisos usando los botones directos sin escribir nombres de comandos ni plataformas.\n\n' +
        '╭─ **ACCIONES DISPONIBLES** ────────────────╮\n' +
        '│ 👤 **Asignar Revendedor**  ▸ Dar tiempo y marcar checks\n' +
        '│ 🔐 **Modificar Permisos**  ▸ Cambiar páginas con checks\n' +
        '│ ❌ **Quitar Revendedor**   ▸ Revocar acceso total\n' +
        '│ 📦 **Cargar Stock**        ▸ Lote de keys para KeyAuth\n' +
        '│ 🔍 **Info Revendedor**     ▸ Consultar días restantes\n' +
        '│ 📋 **Lista General**       ▸ Todos los revendedores\n' +
        '│ 📊 **Estado & Stock**      ▸ Ver inventario de claves\n' +
        '│ 🌐 **Configurar Páginas**  ▸ Elegir webs activas en este sv\n' +
        '╰───────────────────────────────────────────╯\n' +
        '💡 *Al asignar o modificar permisos, se abrirá un menú con casillas (checks) para elegir las plataformas con un solo clic.*'
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
      .setCustomId('admin_btn_edit_perms')
      .setLabel('Modificar Permisos')
      .setEmoji('🔐')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('admin_btn_remove_reseller')
      .setLabel('Quitar Revendedor')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_btn_add_stock')
      .setLabel('Cargar Stock (KeyAuth)')
      .setEmoji('📦')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('admin_btn_info_reseller')
      .setLabel('Consultar Revendedor')
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('admin_btn_list_resellers')
      .setLabel('Lista de Revendedores')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_btn_view_stock')
      .setLabel('Ver Stock & Estado')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('admin_btn_config_platforms')
      .setLabel('Configurar Páginas')
      .setEmoji('🌐')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

module.exports = { createPanelPayload, createAdminPanelPayload };
