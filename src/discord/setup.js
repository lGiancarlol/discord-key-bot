const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { createPanelPayload, createAdminPanelPayload } = require('./panel');

/**
 * Crea o localiza la estructura estándar de canales en una guild de Discord,
 * aplica los permisos correctos, vincula la base de datos y publica los paneles interactivos.
 */
async function autoSetupGuildChannels(guild, client, db, operatorTag = 'Sistema') {
  if (!guild) {
    throw new Error('Servidor de Discord no encontrado o no accesible.');
  }

  const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('El bot no tiene el permiso "Administrar Canales" en este servidor.');
  }

  const everyoneRole = guild.roles.everyone;
  const botUserId = client.user.id;
  const gDb = db.forGuild(guild.id);
  const botAdmins = gDb.getBotAdmins();

  // Overwrites para canales administrativos (Ocultos a @everyone, visibles para Bot y Admins)
  const adminOverwrites = [
    {
      id: everyoneRole.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: botUserId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  // Dar permiso a cada Admin del Bot en este servidor
  for (const admId of botAdmins) {
    adminOverwrites.push({
      id: admId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  // 1. Categoría Principal
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('panel auth')
  );

  if (!category) {
    category = await guild.channels.create({
      name: '🔐 PANEL AUTH GATEWAY',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: everyoneRole.id,
          allow: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: botUserId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.SendMessages,
          ],
        },
      ],
    });
  }

  // 2. Canal de Licencias para Revendedores (Público de solo lectura, con permisos para botones y comandos)
  let panelChannel = guild.channels.cache.find(
    (c) => c.parentId === category.id && (c.name.includes('licencias') || c.name.includes('panel'))
  );

  if (!panelChannel) {
    panelChannel = await guild.channels.create({
      name: '🔑-licencias',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: everyoneRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.UseApplicationCommands,
          ],
          deny: [PermissionFlagsBits.SendMessages],
        },
        {
          id: botUserId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
          ],
        },
      ],
    });
  }

  // 3. Canal de Panel Administrativo con Botones (Exclusivo Staff)
  let adminPanelChannel = guild.channels.cache.find(
    (c) => c.parentId === category.id && (c.name.includes('admin') || c.name.includes('control'))
  );

  if (!adminPanelChannel) {
    adminPanelChannel = await guild.channels.create({
      name: '🛠️-admin-control',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: adminOverwrites,
    });
  }

  // 4. Canal de Auditoría y Logs (Exclusivo Staff)
  let logsChannel = guild.channels.cache.find(
    (c) => c.parentId === category.id && (c.name.includes('logs') || c.name.includes('auditoria'))
  );

  if (!logsChannel) {
    logsChannel = await guild.channels.create({
      name: '📜-auditoria-logs',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: adminOverwrites,
    });
  }

  // 5. Canal de Voz 24/7 (Para presencia continua del bot)
  let voiceChannel = guild.channels.cache.find(
    (c) => c.parentId === category.id && (c.name.includes('24-7') || c.name.includes('conexion') || c.type === ChannelType.GuildVoice)
  );

  if (!voiceChannel) {
    voiceChannel = await guild.channels.create({
      name: '🔊-conexion-24-7',
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: everyoneRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        },
        {
          id: botUserId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        },
      ],
    });
  }

  // 6. Actualizar configuración en la Base de Datos
  const updatedChannels = {
    panelChannelId: panelChannel.id,
    adminPanelChannelId: adminPanelChannel.id,
    logsChannelId: logsChannel.id,
    voiceChannelId: voiceChannel.id,
  };

  gDb.updateConfig({ channels: updatedChannels });

  // 7. Publicar Paneles Automáticamente en los nuevos canales
  try {
    await panelChannel.send(createPanelPayload(guild.id, db));
  } catch (err) {
    console.warn(`[AutoSetup] Aviso al publicar panel en ${panelChannel.name}:`, err.message);
  }

  try {
    await adminPanelChannel.send(createAdminPanelPayload(guild.id, db));
  } catch (err) {
    console.warn(`[AutoSetup] Aviso al publicar admin panel en ${adminPanelChannel.name}:`, err.message);
  }

  // 8. Mensaje de confirmación en el canal de auditoría
  const auditEmbed = new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle('✅ [SETUP] Canales Configurados Automáticamente')
    .setDescription(
      `El asistente de configuración ha creado y configurado todos los canales de forma exitosa.\n\n` +
      `• **Categoría:** \`${category.name}\`\n` +
      `• **Panel de Licencias:** <#${panelChannel.id}>\n` +
      `• **Panel Administrativo:** <#${adminPanelChannel.id}>\n` +
      `• **Auditoría & Logs:** <#${logsChannel.id}>\n` +
      `• **Voz 24/7:** <#${voiceChannel.id}>\n\n` +
      `Los paneles interactivos ya han sido publicados y están listos para usarse.`
    )
    .setFooter({ text: `Configurado por: ${operatorTag} • Auth Gateway` })
    .setTimestamp();

  try {
    await logsChannel.send({ embeds: [auditEmbed] });
  } catch (_) {}

  // 9. Registrar auditoría interna
  if (gDb.recordWebAuditLog) {
    gDb.recordWebAuditLog({
      operatorTag,
      operatorId: 'SYSTEM',
      action: 'AUTO_SETUP_CHANNELS',
      details: `Categoría "${category.name}" y 4 canales creados y vinculados.`,
    });
  }

  return {
    success: true,
    categoryId: category.id,
    channels: updatedChannels,
  };
}

module.exports = { autoSetupGuildChannels };
