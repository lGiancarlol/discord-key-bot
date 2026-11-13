const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');

const config = require('./config');
const db = require('./database');
const providerManager = require('./providers');
const { createPanelPayload, createAdminPanelPayload } = require('./discord/panel');
const { autoSetupGuildChannels } = require('./discord/setup');
const { startWebServer } = require('./web/server');
const {
  getCreateKeyModal,
  getDeleteKeyModal,
  getResetHwidModal,
  getAdminAssignResellerModal,
  getAdminEditPermsModal,
  getAdminRemoveResellerModal,
  getAdminInfoResellerModal,
  getAdminAddStockModal,
} = require('./discord/modals');
const { commands } = require('./discord/commands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Registrar comandos slash al iniciar
async function registerSlashCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    console.log('[Discord] Registrando comandos Slash...');

    await rest.put(
      Routes.applicationGuildCommands(
        config.discord.clientId,
        config.discord.guildId
      ),
      { body: commands.map((c) => c.toJSON()) }
    );

    console.log('[Discord] Comandos Slash registrados con éxito.');
  } catch (err) {
    console.error('[Discord] Error al registrar comandos Slash:', err);
  }
}

// Obtener información de auditoría y membresía de un usuario
function getUserAuditInfo(member, user, cfg = config, guildId = null) {
  const gId = guildId || member?.guild?.id || config.discord.guildId;
  const userId = user?.id || member?.id;
  if (!userId) {
    return {
      userId: 'Desconocido',
      username: 'Desconocido',
      role: 'Desconocido',
      membership: 'No disponible',
      daysLeft: 0,
      isAdmin: false,
      isReseller: false,
    };
  }

  const username = user?.tag || member?.user?.tag || userId;
  const isServerOwner = member?.guild?.ownerId === userId;
  const isDiscordAdmin = member?.permissions?.has ? member.permissions.has('Administrator') : false;
  const isDesignatedAdmin = db.forGuild(gId).isBotAdmin(userId);
  const isAdmin = isServerOwner || isDiscordAdmin || isDesignatedAdmin;

  if (isAdmin) {
    return {
      userId,
      username,
      role: 'Administrador',
      membership: 'Acceso Ilimitado Permanente',
      daysLeft: null,
      isAdmin: true,
      isReseller: false,
    };
  }

  const reseller = db.forGuild(gId).getReseller(userId);
  if (reseller) {
    const expDate = reseller.expiresAt
      ? new Date(reseller.expiresAt).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : 'N/A';

    if (reseller.isExpired) {
      return {
        userId,
        username,
        role: 'Revendedor (Expirado)',
        membership: `0 días restantes (Venció: ${expDate})`,
        daysLeft: 0,
        isAdmin: false,
        isReseller: true,
      };
    }

    return {
      userId,
      username,
      role: 'Revendedor',
      membership: `${reseller.daysLeft} días restantes (Vence: ${expDate})`,
      daysLeft: reseller.daysLeft,
      isAdmin: false,
      isReseller: true,
    };
  }

  return {
    userId,
    username,
    role: 'Usuario sin Membresía',
    membership: 'Sin membresía activa',
    daysLeft: 0,
    isAdmin: false,
    isReseller: false,
  };
}

// Log a canal de auditoría (estrictamente aislado por servidor) con mención de rol de alerta si corresponde
async function logToAdminChannel(embed, guildId = null, isAlert = false) {
  // Si no se especifica guildId, solo usar el servidor principal por defecto
  const gId = guildId || config.discord.guildId;
  if (!gId) return;

  const gConfig = db.forGuild(gId).getConfig();
  // Aislamiento estricto: cada servidor envía exclusivamente a su propio canal de logs
  const targetChannelId = gConfig?.channels?.logsChannelId || (guildId === null ? config.discord.logsChannelId : null);
  if (!targetChannelId) return; // Si este servidor no configuró canal de logs, no contaminar el canal de otro servidor

  try {
    const channel = await client.channels.fetch(targetChannelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const alertRoleId = gConfig?.channels?.alertRoleId;
      const title = embed?.data?.title || '';
      const shouldPing = alertRoleId && (isAlert || title.includes('ALERTA') || title.includes('SEGURIDAD'));
      await channel.send({
        content: shouldPing ? `<@&${alertRoleId}>` : undefined,
        embeds: [embed],
      });
    }
  } catch (err) {
    console.error(`[Logs] Error al enviar log a guild ${gId}:`, err.message);
  }
}

// Helper compatible para llamadas logToGuildAdminChannel(guild/client, gId, embed)
async function logToGuildAdminChannel(target, gId, embed) {
  if (target instanceof EmbedBuilder) {
    return logToAdminChannel(target, gId);
  }
  return logToAdminChannel(embed || gId, typeof gId === 'string' ? gId : null);
}

const PROVIDER_NAMES = {
  bypass: 'Bypass APK',
  bypass_uid: 'Bypass UID (Auto ON)',
  mycheats: 'WorldCheats (Panel VIP)',
  keyauth: 'KeyAuth (Elite Pro)',
};

async function showPlatformsConfigMenu(interaction, guildId, database) {
  const currentEnabled = database.getEnabledProviders(guildId);
  const metadata = database.getAllProvidersMetadata(guildId);
  const allProviders = [
    { label: metadata.bypass.name.slice(0, 100), value: 'bypass', description: metadata.bypass.desc.slice(0, 100) },
    { label: metadata.bypass_uid.name.slice(0, 100), value: 'bypass_uid', description: metadata.bypass_uid.desc.slice(0, 100) },
    { label: metadata.mycheats.name.slice(0, 100), value: 'mycheats', description: metadata.mycheats.desc.slice(0, 100) },
    { label: metadata.keyauth.name.slice(0, 100), value: 'keyauth', description: metadata.keyauth.desc.slice(0, 100) },
  ];

  const options = allProviders.map((p) => ({
    ...p,
    default: currentEnabled.includes(p.value),
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('select_config_platforms')
    .setPlaceholder('Marca las páginas que funcionarán en este servidor...')
    .setMinValues(1)
    .setMaxValues(allProviders.length)
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(select);

  const embed = new EmbedBuilder()
    .setColor(0x2563eb)
    .setTitle('🌐 CONFIGURACIÓN DE PÁGINAS ACTIVAS')
    .setDescription(
      `Selecciona a continuación qué páginas web / plataformas deseas dejar activas para **${interaction.guild?.name || 'este servidor'}**.\n\n` +
      `Las plataformas desmarcadas **no aparecerán** en el panel de licencias, ni en la creación de revendedores, ni en la emisión de claves de este servidor.`
    )
    .addFields({
      name: 'Actualmente Habilitadas:',
      value: currentEnabled.map((p) => `• **${metadata[p]?.name || p}**`).join('\n') || 'Ninguna',
    })
    .setFooter({ text: 'Sistema de Configuración Multi-Servidor' });

  return interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

// Evento Ready
client.once(Events.ClientReady, async () => {
  console.log(`\n========================================`);
  console.log(`[Bot Online] Conectado como: ${client.user.tag}`);
  console.log(`========================================\n`);

  // Iniciar servidor web y dashboard multi-servidor
  try {
    startWebServer(client);
  } catch (webErr) {
    console.error('[Dashboard Web] Error al iniciar servidor web:', webErr);
  }

  const guild = client.guilds.cache.get(config.discord.guildId);

  if (!guild) {
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&permissions=8&scope=bot%20applications.commands`;
    console.warn(`[Aviso] El bot todavía no está unido a tu servidor.`);
    console.warn(`👉 Invita al bot usando este enlace:\n${inviteLink}\n`);
    return;
  }

  console.log(`[Servidor Encontrado] Conectado a: ${guild.name} (${guild.id})`);
  db.ensureGuild(guild.id, guild.name);
  await registerSlashCommands();
  await checkAndPostPanel(guild);
  await checkAndPostAdminPanel(guild);

  // Conectar al canal de voz 24/7 en todos los servidores donde esté el bot
  for (const g of client.guilds.cache.values()) {
    connectToVoiceChannel(g).catch(() => {});
  }

  // Log administrativo de encendido con diagnóstico de plataformas
  const allStock = db.getAllStock(guild.id);
  const keyauthStock = allStock.keyauth || 0;

  let platformsText = '';
  try {
    const health = await providerManager.checkAllHealth(guild.id, db);
    const healthLines = Object.values(health).map((h) => {
      const icon = h.online ? '🟢' : '🔴';
      const ms = h.latency ? ` (\`${h.latency}ms\`)` : '';
      const info = h.online ? (h.message || 'Activa') : `Error: ${h.error || 'Sin conexión'}`;
      return `${icon} **${h.name}:** ${info}${ms}`;
    });
    if (healthLines.length > 0) {
      platformsText = '\n\n🌐 **Estado de Plataformas Web:**\n' + healthLines.join('\n');
    }
  } catch (_) {}

  await logToAdminChannel(
    new EmbedBuilder()
      .setColor(0x16a34a)
      .setTitle('[SISTEMA] Bot en Línea')
      .setDescription(
        `• Servidor: \`${guild.name}\` (\`${guild.id}\`)\n` +
          `• Tag: \`${client.user.tag}\`\n` +
          `• Canal de Voz 24/7: <#${config.discord.voiceChannelId}>\n` +
          `• Stock KeyAuth: \`${keyauthStock} claves disponibles\`\n` +
          `• Estado: Operacional` +
          platformsText
      )
      .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
      .setTimestamp()
  );

  // Iniciar monitor periódico de salud
  startSystemMonitor(guild);
});

// Control de eventos WebSocket (evitar spam por reanudaciones normales de red)
let discordDisconnectTimer = null;
let notifiedExtendedDisconnect = false;

client.on(Events.ShardDisconnect, async (event, id) => {
  console.warn(`[Discord] Desconexión temporal del WebSocket (Shard ${id}).`);
  if (!discordDisconnectTimer) {
    discordDisconnectTimer = setTimeout(async () => {
      notifiedExtendedDisconnect = true;
      await logToAdminChannel(
        new EmbedBuilder()
          .setColor(0xdc2626)
          .setTitle('[SISTEMA] Conexión Discord Interrumpida')
          .setDescription(`El bot lleva más de 1 minuto sin conexión con Discord (Shard ${id}). Reintentando automáticamente...`)
          .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
          .setTimestamp()
      );
    }, 60000);
  }
});

client.on(Events.ShardReconnecting, async (id) => {
  console.log(`[Discord] Reconectando WebSocket a Discord (Shard ${id})...`);
});

client.on(Events.ShardResume, async (id) => {
  console.log(`[Discord] Conexión WebSocket reanudada con éxito (Shard ${id}).`);
  if (discordDisconnectTimer) {
    clearTimeout(discordDisconnectTimer);
    discordDisconnectTimer = null;
  }
  // Solo notificar si previamente se alertó de una caída prolongada
  if (notifiedExtendedDisconnect) {
    notifiedExtendedDisconnect = false;
    await logToAdminChannel(
      new EmbedBuilder()
        .setColor(0x16a34a)
        .setTitle('[SISTEMA] Conexión Discord Reanudada')
        .setDescription(`La conexión WebSocket con Discord ha sido restablecida correctamente (Shard ${id}).`)
        .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
        .setTimestamp()
    );
  }
});

// Cuando el bot sea invitado a un servidor
client.on('guildCreate', async (guild) => {
  console.log(`[Servidor Unido] El bot fue añadido a: ${guild.name} (${guild.id})`);
  db.ensureGuild(guild.id, guild.name);
  try {
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, guild.id),
      { body: commands.map((c) => c.toJSON()) }
    );
    console.log(`[Discord] Comandos registrados en ${guild.name}`);
  } catch (err) {
    console.error(`[Discord] Error al registrar comandos en ${guild.name}:`, err.message);
  }
  await checkAndPostPanel(guild);
  await checkAndPostAdminPanel(guild);
  await connectToVoiceChannel(guild).catch(() => {});
});

const voiceStates = new Map();

async function connectToVoiceChannel(guild, targetVoiceId = null) {
  if (!guild) return { success: false, error: 'Servidor no válido.' };

  const gConfig = db.forGuild(guild.id).getConfig();
  const voiceChannelId =
    targetVoiceId ||
    gConfig?.channels?.voiceChannelId ||
    (guild.id === config.discord.guildId ? config.discord.voiceChannelId : null);

  if (!voiceChannelId) {
    return {
      success: false,
      error: 'No hay canal de voz configurado para este servidor. Configúralo en el Dashboard Web o con /setup.',
    };
  }

  try {
    let channel = guild.channels.cache.get(voiceChannelId);
    if (!channel) {
      channel = await guild.channels.fetch(voiceChannelId).catch(() => null);
    }

    if (!channel) {
      console.warn(`[Voz] Canal de voz (${voiceChannelId}) no encontrado en ${guild.name} (${guild.id}).`);
      return {
        success: false,
        error: `Canal de voz (ID: ${voiceChannelId}) no encontrado en este servidor.`,
      };
    }

    if (!channel.isVoiceBased()) {
      return {
        success: false,
        error: `El canal "${channel.name}" no es un canal de voz.`,
      };
    }

    // Verificar permisos del bot
    const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    if (botMember) {
      const perms = channel.permissionsFor(botMember);
      if (perms && !perms.has(['ViewChannel', 'Connect'])) {
        return {
          success: false,
          error: `El bot no tiene permisos suficientes (Ver Canal y Conectar) en "${channel.name}".`,
        };
      }
    }

    // Si ya está en este mismo canal activo, no reconectar innecesariamente
    const existingConn = getVoiceConnection(guild.id);
    if (
      existingConn &&
      existingConn.joinConfig?.channelId === channel.id &&
      existingConn.state.status !== VoiceConnectionStatus.Destroyed
    ) {
      console.log(`[Voz] Ya conectado al canal de voz: ${channel.name} en ${guild.name}`);
      return {
        success: true,
        channelName: channel.name,
        channelId: channel.id,
        alreadyConnected: true,
      };
    }

    if (existingConn) {
      try {
        existingConn.destroy();
      } catch (_) {}
    }

    let state = voiceStates.get(guild.id);
    if (!state) {
      state = { reconnecting: false, timer: null };
      voiceStates.set(guild.id, state);
    }
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });

    connection.on(VoiceConnectionStatus.Ready, async () => {
      console.log(`[Voz] Conectado exitosamente al canal de voz: ${channel.name} (${channel.id}) en ${guild.name}`);
      if (state.reconnecting) {
        state.reconnecting = false;
        await logToAdminChannel(
          new EmbedBuilder()
            .setColor(0x16a34a)
            .setTitle('[SISTEMA] Canal de Voz Reconectado')
            .setDescription(`El bot se ha reconectado al canal de voz <#${channel.id}> en **${guild.name}**.`)
            .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
            .setTimestamp(),
          guild.id
        );
      }
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.warn(`[Voz] Desconectado del canal de voz en ${guild.name}. Reintentando en 5s...`);
      state.reconnecting = true;
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        connectToVoiceChannel(guild, voiceChannelId).catch(() => {});
      }, 5000);
      await logToAdminChannel(
        new EmbedBuilder()
          .setColor(0xd97706)
          .setTitle('[SISTEMA] Canal de Voz Desconectado')
          .setDescription(`El bot se desconectó temporalmente del canal de voz <#${voiceChannelId}> en **${guild.name}**. Reintentando reconexión en 5 segundos...`)
          .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
          .setTimestamp(),
        guild.id
      );
    });

    connection.on('error', (err) => {
      console.error(`[Voz] Error en la conexión de voz para ${guild.name}:`, err.message);
    });

    return {
      success: true,
      channelName: channel.name,
      channelId: channel.id,
    };
  } catch (err) {
    console.error(`[Voz] Error al conectar al canal de voz en ${guild.name}:`, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

client.connectToVoiceChannel = (guild, targetVoiceId = null) => connectToVoiceChannel(guild, targetVoiceId);

// Monitor Periódico de Salud del Sistema (cada 15 minutos)
let notifiedKeyauthLow = false;
const platformHealthCache = {};

function startSystemMonitor(guild) {
  setInterval(async () => {
    try {
      // 1. Verificar estado de todas las plataformas web
      const health = await providerManager.checkAllHealth(guild.id, db);
      for (const [pid, h] of Object.entries(health)) {
        const wasOnline = platformHealthCache[pid]?.online ?? true;
        if (!h.online && wasOnline) {
          // La plataforma se cayó o no responde
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xdc2626)
              .setTitle(`[ALERTA] Plataforma Fuera de Línea: ${h.name}`)
              .setDescription(
                `La plataforma **${h.name}** no responde a la comprobación de estado.\n\n` +
                  `• **Error:** \`${h.error || 'Timeout / Sin respuesta'}\`\n` +
                  `• **Acción:** El bot reintentará la conexión en la siguiente verificación.`
              )
              .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
              .setTimestamp(),
            guild.id
          );
        } else if (h.online && !wasOnline) {
          // La plataforma se recuperó
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0x16a34a)
              .setTitle(`[SISTEMA] Plataforma Restablecida: ${h.name}`)
              .setDescription(
                `La plataforma **${h.name}** volvió a responder correctamente.\n\n` +
                  `• **Latencia:** \`${h.latency || 0}ms\`\n` +
                  `• **Estado:** Operacional`
              )
              .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
              .setTimestamp(),
            guild.id
          );
        }
        platformHealthCache[pid] = h;
      }

      // 2. Verificar nivel de Stock de KeyAuth para este servidor
      const stock = db.getStock('keyauth', guild.id);
      if (stock.length <= 3 && !notifiedKeyauthLow) {
        notifiedKeyauthLow = true;
        await logToAdminChannel(
          new EmbedBuilder()
            .setColor(0xd97706)
            .setTitle('[STOCK] Nivel Crítico de Inventario')
            .setDescription(
              stock.length === 0
                ? `El inventario de KeyAuth (Elite Pro) está completamente agotado en este servidor.\nSe requiere recarga desde el Panel Administrativo o comando /stock add.`
                : `Quedan únicamente **${stock.length} claves** de KeyAuth en inventario para este servidor.`
            )
            .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
            .setTimestamp(),
          guild.id
        );
      } else if (stock.length > 3) {
        notifiedKeyauthLow = false;
      }

      // 3. Revisar vencimientos de revendedores de este servidor
      const resellers = db.getAllResellers(guild.id);
      const now = Date.now();
      for (const r of resellers) {
        const expTime = new Date(r.expiresAt).getTime();
        const diffMs = expTime - now;

        // Si expiró hace menos de 20 minutos (notificar una sola vez)
        if (now >= expTime && (now - expTime) < (20 * 60 * 1000)) {
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xdc2626)
              .setTitle('[MEMBRESÍA] Vencimiento de Revendedor')
              .setDescription(
                `La membresía del revendedor <@${r.userId}> ha vencido hoy en este servidor.\n` +
                  `El usuario no podrá generar claves hasta que se le renueve el tiempo con el comando /revendedor asignar o desde el Panel Administrativo.`
              )
              .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
              .setTimestamp(),
            guild.id
          );
        }
      }
    } catch (err) {
      console.error('[Monitor] Error en rutina de monitoreo:', err.message);
    }
  }, 15 * 60 * 1000); // Ejecutar cada 15 minutos
}

async function checkAndPostPanel(guild) {
  const gConfig = db.forGuild(guild.id).getConfig();
  const channelId = gConfig?.channels?.panelChannelId || (guild.id === config.discord.guildId ? config.discord.panelChannelId : null);
  if (!channelId) return;
  try {
    const panelChannel = await guild.channels.fetch(channelId).catch(() => null);
    if (panelChannel && panelChannel.isTextBased()) {
      const messages = await panelChannel.messages.fetch({ limit: 10 }).catch(() => null);
      const existing = messages?.find(
        (m) => m.author.id === client.user.id && m.embeds.length > 0 && !m.embeds[0].title?.includes('ADMINISTRATIVO')
      );
      if (!existing) {
        await panelChannel.send(createPanelPayload(guild.id, db));
        console.log(`[Panel] Panel de licencias publicado en el servidor ${guild.name} (${channelId}).`);
      } else {
        await existing.edit(createPanelPayload(guild.id, db));
        console.log(`[Panel] Panel de licencias actualizado en el servidor ${guild.name} (${channelId}).`);
      }
    }
  } catch (err) {
    console.error(`[Panel] Error al verificar/publicar panel en ${guild.name}:`, err.message);
  }
}

async function checkAndPostAdminPanel(guild) {
  const gConfig = db.forGuild(guild.id).getConfig();
  const channelId = gConfig?.channels?.adminPanelChannelId || (guild.id === config.discord.guildId ? config.discord.adminPanelChannelId : null);
  if (!channelId) return;
  try {
    const adminChannel = await guild.channels.fetch(channelId).catch(() => null);
    if (adminChannel && adminChannel.isTextBased()) {
      const messages = await adminChannel.messages.fetch({ limit: 10 }).catch(() => null);
      const existing = messages?.find(
        (m) => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title?.includes('ADMINISTRATIVO')
      );
      if (!existing) {
        await adminChannel.send(createAdminPanelPayload(guild.id, db));
        console.log(`[AdminPanel] Panel administrativo publicado en ${guild.name} (${channelId}).`);
      } else {
        await existing.edit(createAdminPanelPayload(guild.id, db));
        console.log(`[AdminPanel] Panel administrativo actualizado en ${guild.name} (${channelId}).`);
      }
    }
  } catch (err) {
    console.error(`[AdminPanel] Error al verificar/publicar panel administrativo en ${guild.name}:`, err.message);
  }
}

function extractUserId(input) {
  if (!input) return null;
  const match = input.match(/\d{17,20}/);
  return match ? match[0] : null;
}

// Generador de plantilla "Listo para Reenviar" (WhatsApp / Telegram) con formato personalizable por servidor
function getForwardTemplate({ providerName, keyOrUser, days, isAccount = false, guildId = null }) {
  return db.formatForwardTemplate({ providerName, keyOrUser, days, isAccount, guildId });
}

// Manejo de Interacciones
client.on('interactionCreate', async (interaction) => {
  try {
    // 1. COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      // /setup (Configuración inicial en 1 clic)
      if (commandName === 'setup') {
        const perms = db.getUserPermissions(interaction.member, config, interaction.guildId);
        if (!perms.isAdmin) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** Solo administradores pueden ejecutar la configuración automática.',
            ephemeral: true,
          });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const result = await autoSetupGuildChannels(
            interaction.guild,
            client,
            db,
            interaction.user.tag
          );

          const setupEmbed = new EmbedBuilder()
            .setColor(0x10b981)
            .setTitle('🚀 Configuración Automática Completada')
            .setDescription(
              `Se han creado y vinculado con éxito todos los canales en **${interaction.guild.name}**:\n\n` +
              `• 🔑 **Panel de Licencias:** <#${result.channels.panelChannelId}>\n` +
              `• 🛠️ **Panel Administrativo:** <#${result.channels.adminPanelChannelId}>\n` +
              `• 📜 **Auditoría & Logs:** <#${result.channels.logsChannelId}>\n` +
              `• 🔊 **Voz 24/7:** <#${result.channels.voiceChannelId}>\n\n` +
              `✅ Los paneles interactivos ya han sido publicados en sus respectivos canales y están listos para operar.`
            )
            .setFooter({ text: 'Sistema Multi-Servidor • Auth Gateway' })
            .setTimestamp();

          return interaction.editReply({ embeds: [setupEmbed] });
        } catch (err) {
          return interaction.editReply({
            content: `❌ **Error al configurar canales:** ${err.message}`,
          });
        }
      }

      // /panel
      if (commandName === 'panel') {
        await interaction.channel.send(createPanelPayload(interaction.guildId, db));
        return interaction.reply({
          content: '✅ Panel interactivo publicado con éxito.',
          ephemeral: true,
        });
      }

      // /admin-panel
      if (commandName === 'admin-panel') {
        await interaction.channel.send(createAdminPanelPayload(interaction.guildId, db));
        return interaction.reply({
          content: '✅ Panel de control administrativo publicado con éxito.',
          ephemeral: true,
        });
      }

      // /plataformas
      if (commandName === 'plataformas') {
        const perms = db.getUserPermissions(interaction.member, config, interaction.guildId);
        if (!perms.isAdmin) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** Solo administradores pueden configurar las plataformas.',
            ephemeral: true,
          });
        }
        return showPlatformsConfigMenu(interaction, interaction.guildId, db);
      }

      // /conectar-voz
      if (commandName === 'conectar-voz') {
        const perms = db.getUserPermissions(interaction.member, config, interaction.guildId);
        if (!perms.isAdmin) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** Solo administradores pueden conectar el bot al canal de voz.',
            ephemeral: true,
          });
        }
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;
        if (!guild) {
          return interaction.editReply({ content: '❌ Este comando solo puede ejecutarse dentro de un servidor de Discord.' });
        }
        const res = await connectToVoiceChannel(guild);
        if (res.success) {
          return interaction.editReply({
            content: `🔊 **¡Conectado exitosamente!**\nEl bot ahora está conectado al canal de voz **<#${res.channelId}>** (modo 24/7 activo en este servidor).`,
          });
        } else {
          return interaction.editReply({
            content: `❌ **No se pudo conectar al canal de voz:**\n${res.error}\n\n💡 *Tip: Puedes configurar o corregir el canal de voz usando \`/setup\` o desde el Dashboard Web.*`,
          });
        }
      }

      // /admin (Gestión de Administradores del Bot)
      if (commandName === 'admin') {
        const isOwner = interaction.user.id === config.discord.ownerId || interaction.guild?.ownerId === interaction.user.id;
        if (!isOwner) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** Solo el Dueño del Bot puede nombrar o revocar administradores.',
            ephemeral: true,
          });
        }

        const gId = interaction.guildId || config.discord.guildId;
        const sub = interaction.options.getSubcommand();

        if (sub === 'agregar') {
          const target = interaction.options.getUser('usuario');
          const added = db.forGuild(gId).addBotAdmin(target.id);

          if (added) {
            const embed = new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle('👑 Nuevo Administrador del Bot')
              .setDescription(
                `Se ha nombrado a <@${target.id}> (${target.tag}) como **Administrador del Bot** en este servidor.\nAhora tiene acceso total para gestionar revendedores, stock y paneles de este servidor.`
              )
              .setTimestamp();

            const opAudit = getUserAuditInfo(interaction.member, interaction.user, config);
            await logToGuildAdminChannel(
              client,
              gId,
              new EmbedBuilder()
                .setColor(0x16a34a)
                .setTitle('[ADMINISTRACIÓN] Asignación de Administrador')
                .addFields(
                  { name: 'Operador', value: `<@${interaction.user.id}>`, inline: true },
                  { name: 'Rango Operador', value: opAudit.role, inline: true },
                  { name: 'Usuario Designado', value: `<@${target.id}>`, inline: true },
                  { name: 'Servidor', value: interaction.guild?.name || gId, inline: true }
                )
                .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
                .setTimestamp()
            );

            return interaction.reply({ embeds: [embed], ephemeral: true });
          } else {
            return interaction.reply({
              content: `ℹ️ El usuario <@${target.id}> ya era Administrador del Bot en este servidor.`,
              ephemeral: true,
            });
          }
        }

        if (sub === 'quitar') {
          const target = interaction.options.getUser('usuario');
          const removed = db.forGuild(gId).removeBotAdmin(target.id);

          if (removed) {
            const opAudit = getUserAuditInfo(interaction.member, interaction.user, config);
            await logToGuildAdminChannel(
              client,
              gId,
              new EmbedBuilder()
                .setColor(0xdc2626)
                .setTitle('[ADMINISTRACIÓN] Revocación de Administrador')
                .addFields(
                  { name: 'Operador', value: `<@${interaction.user.id}>`, inline: true },
                  { name: 'Rango Operador', value: opAudit.role, inline: true },
                  { name: 'Usuario Revocado', value: `<@${target.id}>`, inline: true },
                  { name: 'Servidor', value: interaction.guild?.name || gId, inline: true }
                )
                .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
                .setTimestamp()
            );

            return interaction.reply({
              content: `🗑️ Se ha revocado el rango de Administrador del Bot a <@${target.id}> en este servidor.`,
              ephemeral: true,
            });
          } else {
            return interaction.reply({
              content: `⚠️ El usuario <@${target.id}> no estaba en la lista de Administradores de este servidor.`,
              ephemeral: true,
            });
          }
        }

        if (sub === 'lista') {
          const list = db.forGuild(gId).getBotAdmins();
          const serverOwnerId = interaction.guild?.ownerId || config.discord.ownerId;

          const lines = [
            `• 👑 **Dueño:** <@${config.discord.ownerId}>`,
            ...(serverOwnerId !== config.discord.ownerId ? [`• 👑 **Dueño del Servidor:** <@${serverOwnerId}>`] : []),
            ...list.map((id) => `• 🛡️ **Admin Designado:** <@${id}>`),
          ];

          const embed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(`👑 Administradores de ${interaction.guild?.name || 'Servidor'}`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'Sistema de Administradores por Servidor' })
            .setTimestamp();

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      // /revendedor
      if (commandName === 'revendedor') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'asignar') {
          const target = interaction.options.getUser('usuario');
          const dias = interaction.options.getInteger('dias');
          const limiteDiario = interaction.options.getInteger('limite_diario') || 0;
          const platInput = interaction.options.getString('plataformas') || 'all';

          let platforms = [];
          if (platInput.toLowerCase() === 'all') {
            platforms = Object.keys(config.providers);
          } else {
            platforms = platInput
              .split(',')
              .map((p) => p.trim().toLowerCase())
              .filter((p) => config.providers[p]);
          }

          if (platforms.length === 0) {
            platforms = Object.keys(config.providers);
          }

          const res = db.setReseller(target.id, dias, platforms, interaction.user.tag, limiteDiario, interaction.guildId);
          const expDate = new Date(res.expiresAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });

          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Membresía de Revendedor Asignada')
            .setDescription(
              `Se ha configurado la membresía para <@${target.id}>:\n\n` +
                `⏳ **Tiempo otorgado:** +${dias} días\n` +
                `📅 **Días restantes totales:** **${res.daysLeft} días** (Vence: \`${expDate}\`)\n` +
                `🎯 **Límite diario:** ${limiteDiario > 0 ? `**${limiteDiario} keys/día**` : '**Sin límite (Ilimitado)**'}\n` +
                `🌐 **Plataformas autorizadas:** \`${res.allowedProviders.join(', ')}\``
            )
            .setFooter({ text: 'Sistema de Revendedores • Auth Gateway' })
            .setTimestamp();

          const opAudit = getUserAuditInfo(interaction.member, interaction.user, config);
          const targetAudit = getUserAuditInfo(null, target, config);
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0x16a34a)
              .setTitle('[ADMINISTRACIÓN] Asignación de Revendedor')
              .addFields(
                { name: 'Operador', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Rango Operador', value: opAudit.role, inline: true },
                { name: 'Revendedor Asignado', value: `<@${target.id}>`, inline: true },
                { name: 'Tiempo Otorgado', value: `+${dias} días`, inline: true },
                { name: 'Membresía Resultante', value: targetAudit.membership, inline: true },
                { name: 'Límite Diario', value: limiteDiario > 0 ? `${limiteDiario} keys/día` : 'Sin límite', inline: true },
                { name: 'Plataformas Autorizadas', value: res.allowedProviders.map((pid) => config.providers[pid]?.name || pid).join(', '), inline: false }
              )
              .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
              .setTimestamp()
          );

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'quitar') {
          const gId = interaction.guildId || config.discord.guildId;
          const target = interaction.options.getUser('usuario');
          const removed = db.removeReseller(target.id, gId);

          if (removed) {
            const opAudit = getUserAuditInfo(interaction.member, interaction.user, config, gId);
            await logToAdminChannel(
              new EmbedBuilder()
                .setColor(0xdc2626)
                .setTitle('[ADMINISTRACIÓN] Revocación de Revendedor')
                .addFields(
                  { name: 'Operador', value: `<@${interaction.user.id}>`, inline: true },
                  { name: 'Rango Operador', value: opAudit.role, inline: true },
                  { name: 'Revendedor Revocado', value: `<@${target.id}>`, inline: true }
                )
                .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
                .setTimestamp(),
              gId
            );
          }

          return interaction.reply({
            content: removed
              ? `🗑️ Se ha revocado la membresía de revendedor para <@${target.id}> en este servidor.`
              : `⚠️ El usuario <@${target.id}> no estaba registrado como revendedor en este servidor.`,
            ephemeral: true,
          });
        }

        if (sub === 'info') {
          const gId = interaction.guildId || config.discord.guildId;
          const target = interaction.options.getUser('usuario');
          const res = db.getReseller(target.id, gId);

          if (!res) {
            return interaction.reply({
              content: `ℹ️ El usuario <@${target.id}> no tiene membresía de revendedor asignada en este servidor.`,
              ephemeral: true,
            });
          }

          const statusText = res.isExpired ? '🔴 Expirado' : `🟢 Activo (${res.daysLeft} días restantes)`;
          const expDate = new Date(res.expiresAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          });

          const gMeta = db.getAllProvidersMetadata(gId);
          const platNames = res.allowedProviders.map((pid) => gMeta[pid]?.name || pid).join(', ') || 'Ninguna';

          const embed = new EmbedBuilder()
            .setColor(res.isExpired ? 0xe74c3c : 0x00d2d3)
            .setTitle(`👤 Perfil de Revendedor: ${target.tag}`)
            .setDescription(
              `• **Servidor:** ${interaction.guild?.name || 'Este Servidor'}\n` +
                `• **Estado:** ${statusText}\n` +
                `• **Vencimiento:** \`${expDate}\`\n` +
                `• **Plataformas autorizadas:** \`${platNames}\`\n` +
                `• **Asignado por:** ${res.addedBy}`
            )
            .setTimestamp();

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'lista') {
          const gId = interaction.guildId || config.discord.guildId;
          const all = db.getAllResellers(gId);
          if (all.length === 0) {
            return interaction.reply({
              content: `ℹ️ No hay revendedores registrados actualmente en **${interaction.guild?.name || 'este servidor'}**.`,
              ephemeral: true,
            });
          }

          const gMeta = db.getAllProvidersMetadata(gId);
          const lines = all.map((r) => {
            const expDate = new Date(r.expiresAt).toLocaleDateString('es-ES');
            const state = r.isExpired ? '🔴 Expirado' : `🟢 ${r.daysLeft}d restantes`;
            const plats = r.allowedProviders.map((pid) => gMeta[pid]?.name || pid).join(', ');
            return `• <@${r.userId}> ➔ ${state} (Vence: \`${expDate}\`) | [${plats}]`;
          });

          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📋 Revendedores de ${interaction.guild?.name || 'este servidor'}`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'Sistema Multi-Servidor • Auth Gateway' });

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      // /stock
      if (commandName === 'stock') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
          const providerId = interaction.options.getString('proveedor');
          if (providerId !== 'keyauth') {
            return interaction.reply({
              content: '❌ **Solo KeyAuth (Elite Pro) requiere stock manual precargado.**\nLas demás plataformas (Bypass APK, Bypass UID y WorldCheats) generan sus licencias automáticamente vía API en tiempo real.',
              ephemeral: true,
            });
          }

          const rawKeys = interaction.options.getString('claves');
          const duracion = interaction.options.getInteger('duracion') || 30;
          const keysList = rawKeys.split(/[\s,\n]+/).map((k) => k.trim()).filter((k) => k.length > 0);

          const gId = interaction.guildId || config.discord.guildId;
          const result = db.addStock(providerId, keysList, duracion, gId);
          const pMeta = db.getProviderMetadata(gId, providerId);
          const pName = pMeta?.name || config.providers[providerId]?.name || 'KeyAuth (Elite Pro)';

          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('📦 Stock de Claves Actualizado')
            .setDescription(
              `• **Plataforma:** \`${pName}\`\n` +
                `• **Claves añadidas:** **+${result.added}**\n` +
                `• **Duración configurada:** **${duracion} días**\n` +
                `• **Stock total disponible:** **${result.total} claves**`
            )
            .setTimestamp();

          const opAudit = getUserAuditInfo(interaction.member, interaction.user, config, gId);
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0x16a34a)
              .setTitle('[STOCK] Recarga de Inventario')
              .addFields(
                { name: 'Operador', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Rango Operador', value: opAudit.role, inline: true },
                { name: 'Plataforma', value: pName, inline: true },
                { name: 'Claves Añadidas', value: `+${result.added} claves`, inline: true },
                { name: 'Duración por Clave', value: `${duracion} días`, inline: true },
                { name: 'Stock Total Disponible', value: `${result.total} claves`, inline: true }
              )
              .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
              .setTimestamp(),
            gId
          );

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'list') {
          const gId = interaction.guildId || config.discord.guildId;
          const allStock = db.getAllStock(gId);
          const keyCount = allStock.keyauth || 0;
          const icon = keyCount > 5 ? '🟢' : keyCount > 0 ? '🟡' : '🔴';

          const breakdown = db.getStockBreakdown('keyauth', gId);
          const breakdownLines = Object.entries(breakdown)
            .filter(([_, c]) => c > 0)
            .map(([d, c]) => `  ▫️ **${d} días:** \`${c} claves disponibles\``);
          const breakdownText = breakdownLines.length > 0 ? `\n${breakdownLines.join('\n')}` : '\n  *(Sin claves cargadas)*';

          const embed = new EmbedBuilder()
            .setColor(0x00d2d3)
            .setTitle('📦 Inventario de Stock Precargado')
            .setDescription(
              `${icon} **KeyAuth (Elite Pro):** \`${keyCount} claves en total\`${breakdownText}\n\n` +
              `⚡ **Bypass APK / UID:** \`Generación Automática (API Directa)\`\n` +
              `⚡ **WorldCheats:** \`Generación Automática (API Directa)\`\n\n` +
              `💡 *Puedes solicitar claves de 1 día, 7 días, 15 días o 30 días según el stock disponible.*`
            )
            .setTimestamp();

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      // /mi-perfil
      if (commandName === 'mi-perfil') {
        const gId = interaction.guildId || config.discord.guildId;
        const perms = db.getUserPermissions(interaction.member, config, gId);
        const userKeys = db.getUserKeys(interaction.user.id, 100, gId);
        const gMeta = db.getAllProvidersMetadata(gId);

        let membershipDesc = '';
        if (perms.isAdmin) {
          membershipDesc = '👑 **Rango:** `Administrador / Dueño` (Acceso Ilimitado Permanente)';
        } else if (perms.isReseller) {
          if (perms.isExpired) {
            membershipDesc = '🔴 **Estado:** `Membresía Expirada` (Contacta al dueño para renovar)';
          } else {
            const expDate = new Date(perms.expiresAt).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            });
            membershipDesc = `🟢 **Estado:** Activo\n⏳ **Tiempo restante:** **${perms.daysLeft} días** (Vence: \`${expDate}\`)`;
          }
        } else {
          membershipDesc = '⛔ **Estado:** Sin membresía de revendedor activa en este servidor';
        }

        const platNames = perms.allowedProviders.map((pid) => gMeta[pid]?.name || pid).join(', ') || 'Ninguna';

        const embed = new EmbedBuilder()
          .setColor(perms.isExpired ? 0xe74c3c : 0x00d2d3)
          .setTitle('👤 Tu Perfil de Revendedor')
          .setDescription(
            `👤 **Usuario:** <@${interaction.user.id}>\n` +
              `🏠 **Servidor:** ${interaction.guild?.name || 'Este Servidor'}\n\n` +
              `${membershipDesc}\n\n` +
              `🌐 **Plataformas autorizadas:**\n\`${platNames}\`\n\n` +
              `📊 **Total licencias emitidas en este servidor:** **${userKeys.length}**`
          )
          .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // /mis-keys
      if (commandName === 'mis-keys') {
        const gId = interaction.guildId || config.discord.guildId;
        const userKeys = db.getUserKeys(interaction.user.id, 15, gId);
        if (userKeys.length === 0) {
          return interaction.reply({
            content: `ℹ️ Aún no has generado ninguna licencia en **${interaction.guild?.name || 'este servidor'}**.`,
            ephemeral: true,
          });
        }

        const gMeta = db.getAllProvidersMetadata(gId);
        const lines = userKeys.map(
          (k, idx) =>
            `${idx + 1}. \`${k.key}\` (${k.days}d) - **${gMeta[k.providerId]?.name || k.providerId}**`
        );

        const options = userKeys.slice(0, 15).map((k) => ({
          label: k.key.length > 25 ? `${k.key.substring(0, 22)}...` : k.key,
          value: `${k.providerId}|${k.key}`,
          description: `${k.days}d - ${gMeta[k.providerId]?.name || k.providerId}`,
        }));

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_quick_hwid_reset')
            .setPlaceholder('🔄 Selecciona una de tus claves para Resetear HWID')
            .addOptions(options)
        );

        const embed = new EmbedBuilder()
          .setColor(0x00a8ff)
          .setTitle('📋 Tus Licencias Generadas (Panel Personal)')
          .setDescription(
            lines.join('\n') +
              '\n\n💡 *Puedes resetear el HWID de cualquiera de tus clientes usando el selector inferior:*'
          )
          .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          components: [selectRow],
          ephemeral: true,
        });
      }

      // /stats
      if (commandName === 'stats') {
        await interaction.deferReply({ ephemeral: true });
        const bypass = providerManager.get('bypass');
        let bypassInfo = 'Desconectado';
        try {
          const licList = await bypass.listKeys();
          bypassInfo = `🟢 Conectado (${licList.length} licencias registradas)`;
        } catch {
          bypassInfo = '🔴 Error de conexión';
        }

        const allStock = db.getAllStock();
        const keyauthStock = allStock.keyauth || 0;

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('📊 Estado de Servicios y Plataformas')
          .addFields(
            { name: 'Bypass APK', value: bypassInfo, inline: false },
            { name: 'Bypass UID (Auto ON)', value: '🟢 Sistema Online (172.96.172.132:3000)', inline: false },
            { name: 'WorldCheats (Panel VIP)', value: '🟢 Sistema Online (App 146)', inline: false },
            {
              name: 'KeyAuth (Elite Pro)',
              value: keyauthStock > 0 ? `🟢 Stock Online (${keyauthStock} claves disponibles)` : '⚠️ Stock Agotado (Recargar con /stock add)',
              inline: false,
            },
            { name: 'Total Creadas por Bot', value: `${db.data.generatedKeys.length}`, inline: true }
          )
          .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // /prefijo (Ver o cambiar prefijo predeterminado por servidor)
      if (commandName === 'prefijo') {
        const isOwner = interaction.user.id === config.discord.ownerId || interaction.guild?.ownerId === interaction.user.id;
        const isAdmin = isOwner || db.forGuild(interaction.guildId).isBotAdmin(interaction.user.id);
        const gId = interaction.guildId || config.discord.guildId;

        const nuevo = interaction.options.getString('nuevo');
        if (!nuevo) {
          const currentPrefix = db.forGuild(gId).getDefaultPrefix();
          const embed = new EmbedBuilder()
            .setColor(0x3b82f6)
            .setTitle(`🏷️ Prefijo Predeterminado de ${interaction.guild?.name || 'Servidor'}`)
            .setDescription(`El prefijo predeterminado actual en este servidor es: **\`${currentPrefix}\`**\n\nTodas las claves y cuentas generadas en este servidor llevarán este prefijo automáticamente si no se especifica uno diferente.`)
            .setFooter({ text: 'Usa /prefijo nuevo:<prefijo> para cambiarlo' })
            .setTimestamp();
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!isAdmin) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** Solo los Administradores de este servidor pueden cambiar el prefijo.',
            ephemeral: true,
          });
        }

        const saved = db.forGuild(gId).setDefaultPrefix(nuevo);
        const embed = new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle('✅ Prefijo Predeterminado Actualizado')
          .setDescription(`El nuevo prefijo predeterminado para **${interaction.guild?.name || 'este servidor'}** es: **\`${saved}\`**.\n\nA partir de ahora, todas las claves emitidas por botones, comandos o panel web en este servidor usarán este prefijo por defecto.`)
          .setFooter({ text: 'Sistema Multi-Servidor • Auth Gateway' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // /acceso-web (Control Maestro de Acceso Web por ID - SOLO DUEÑO DEL BOT)
      if (commandName === 'acceso-web') {
        const isMasterOwner = interaction.user.id === config.discord.ownerId;
        if (!isMasterOwner) {
          return interaction.reply({
            content: `⛔ **Acceso Denegado:** Este comando está restringido exclusivamente al **Dueño Maestro del Bot** (<@${config.discord.ownerId}>). Nadie más puede autorizar el ingreso al panel web.`,
            ephemeral: true,
          });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'autorizar') {
          const userId = interaction.options.getString('usuario_id')?.trim();
          const servidor = interaction.options.getString('servidor')?.trim() || 'all';
          const nota = interaction.options.getString('nota')?.trim() || '';

          if (!/^\d{17,20}$/.test(userId)) {
            return interaction.reply({
              content: '❌ **ID inválida:** La ID de usuario de Discord debe contener entre 17 y 20 dígitos numéricos.',
              ephemeral: true,
            });
          }

          let tag = `Usuario ${userId}`;
          try {
            const u = await client.users.fetch(userId);
            if (u) tag = u.tag || u.username;
          } catch (_) {}

          const guilds = (servidor.toLowerCase() === 'all' || servidor === '*') ? ['*'] : [servidor];
          const added = db.addWebUser(userId, {
            tag,
            guilds,
            note: nota,
            addedBy: interaction.user.id,
          });

          const embed = new EmbedBuilder()
            .setColor(0x8b5cf6)
            .setTitle('🔐 Acceso Web Autorizado')
            .setDescription(`Se ha concedido acceso al Panel Web a <@${userId}> (\`${tag}\`).`)
            .addFields(
              { name: 'ID de Discord', value: `\`${userId}\``, inline: true },
              { name: 'Servidores Permitidos', value: guilds.includes('*') ? '🌐 Todos los Servidores (Global)' : `ID: \`${servidor}\``, inline: true },
              { name: 'Nota / Motivo', value: nota || 'Sin nota especificada', inline: false }
            )
            .setFooter({ text: 'Control Maestro de Acceso Web • Auth Gateway' })
            .setTimestamp();

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'revocar') {
          const userId = interaction.options.getString('usuario_id')?.trim();
          try {
            const removed = db.removeWebUser(userId);
            if (removed) {
              return interaction.reply({
                content: `✅ Se ha revocado el acceso al panel web para el usuario con ID \`${userId}\`. Ya no podrá iniciar sesión en la web.`,
                ephemeral: true,
              });
            } else {
              return interaction.reply({
                content: `ℹ️ El usuario con ID \`${userId}\` no estaba en la lista de acceso web.`,
                ephemeral: true,
              });
            }
          } catch (err) {
            return interaction.reply({
              content: `❌ ${err.message}`,
              ephemeral: true,
            });
          }
        }

        if (sub === 'lista') {
          const users = db.getWebAccessUsers();
          const lines = users.map((u) => {
            const crown = u.isMasterOwner ? '👑 **Dueño del Bot**' : '🔑 **Operador Autorizado**';
            const srv = u.guilds.includes('*') ? 'Todos los servidores' : `${u.guilds.length} servidor(es)`;
            const noteText = u.note ? ` • *${u.note}*` : '';
            return `${crown}: <@${u.userId}> (\`${u.userId}\`)\n   └ Acceso: ${srv}${noteText}`;
          });

          const embed = new EmbedBuilder()
            .setColor(0x8b5cf6)
            .setTitle('🔐 Lista Blanca de Acceso al Panel Web')
            .setDescription(`Únicamente las siguientes cuentas de Discord tienen permiso para iniciar sesión en la web:\n\n${lines.join('\n\n')}`)
            .setFooter({ text: 'Solo tú puedes autorizar o revocar accesos web' })
            .setTimestamp();

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }
    }

    // 2. BOTONES DEL PANEL
    if (interaction.isButton()) {
      const { customId, member, user, guildId } = interaction;
      const perms = db.getUserPermissions(member, config, guildId);

      // ── BOTONES EXCLUSIVOS DEL PANEL ADMINISTRATIVO ──
      if (customId.startsWith('admin_btn_')) {
        if (!perms.isAdmin) {
          const audit = getUserAuditInfo(member, user, config, guildId);
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0x64748b)
              .setTitle('[SEGURIDAD] Intento de Acceso a Panel Administrativo')
              .addFields(
                { name: 'Operador', value: `<@${user.id}>`, inline: true },
                { name: 'Rango', value: audit.role, inline: true },
                { name: 'Membresía', value: audit.membership, inline: true },
                { name: 'Acción Bloqueada', value: `Botón: \`${customId}\``, inline: false }
              )
              .setFooter({ text: 'Sistema de Seguridad • Auth Gateway' })
              .setTimestamp(),
            guildId
          );
          return interaction.reply({
            content: '⛔ **Acceso denegado:** Solo los Administradores del Bot tienen permiso para interactuar con este panel.',
            ephemeral: true,
          });
        }

        if (customId === 'admin_btn_assign_reseller') {
          return interaction.showModal(getAdminAssignResellerModal());
        }

        if (customId === 'admin_btn_edit_perms') {
          return interaction.showModal(getAdminEditPermsModal());
        }

        if (customId === 'admin_btn_remove_reseller') {
          return interaction.showModal(getAdminRemoveResellerModal());
        }

        if (customId === 'admin_btn_info_reseller') {
          return interaction.showModal(getAdminInfoResellerModal());
        }

        if (customId === 'admin_btn_add_stock') {
          return interaction.showModal(getAdminAddStockModal());
        }

        if (customId === 'admin_btn_view_stock') {
          await interaction.deferReply({ ephemeral: true });
          const gId = interaction.guildId || config.discord.guildId;
          const allStock = db.getAllStock(gId);
          const keyCount = allStock.keyauth || 0;
          const icon = keyCount > 5 ? '🟢' : keyCount > 0 ? '🟡' : '🔴';

          const breakdown = db.getStockBreakdown('keyauth', gId);
          const breakdownLines = Object.entries(breakdown)
            .filter(([_, c]) => c > 0)
            .map(([d, c]) => `  ▫️ **${d} días:** \`${c} claves disponibles\``);
          const breakdownText = breakdownLines.length > 0 ? `\n${breakdownLines.join('\n')}` : '\n  *(Sin claves cargadas)*';

          // Diagnóstico en tiempo real de las plataformas web
          let healthText = '';
          try {
            const health = await providerManager.checkAllHealth(gId, db);
            const healthLines = Object.values(health).map((h) => {
              const hIcon = h.online ? '🟢' : '🔴';
              const ms = h.latency ? ` (\`${h.latency}ms\`)` : '';
              const state = h.online ? (h.message || 'Activa') : `Error: ${h.error || 'Sin conexión'}`;
              return `${hIcon} **${h.name}:** ${state}${ms}`;
            });
            if (healthLines.length > 0) {
              healthText = '\n\n🌐 **Estado de Plataformas Web (En Vivo):**\n' + healthLines.join('\n');
            }
          } catch (_) {}

          const embed = new EmbedBuilder()
            .setColor(0x00d2d3)
            .setTitle('📊 Inventario de Stock & Estado de Plataformas')
            .setDescription(
              `${icon} **KeyAuth (Elite Pro):** \`${keyCount} claves en total\`${breakdownText}` +
              healthText +
              `\n\n💡 *Bypass APK y WorldCheats son plataformas de generación automática en tiempo real. KeyAuth funciona por stock precargado por días.*`
            )
            .setFooter({ text: 'Panel Administrativo • Auth Gateway' })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        if (customId === 'admin_btn_list_resellers') {
          await interaction.deferReply({ ephemeral: true });
          const gId = interaction.guildId || config.discord.guildId;
          const all = db.getAllResellers(gId);
          if (all.length === 0) {
            return interaction.editReply({
              content: `ℹ️ No hay revendedores registrados actualmente en **${interaction.guild?.name || 'este servidor'}**.`,
            });
          }

          const gMeta = db.getAllProvidersMetadata(gId);
          const lines = all.map((r) => {
            const expDate = new Date(r.expiresAt).toLocaleDateString('es-ES');
            const state = r.isExpired ? '🔴 Expirado' : `🟢 ${r.daysLeft}d restantes`;
            const plats = r.allowedProviders.map((pid) => gMeta[pid]?.name || pid).join(', ');
            return `• <@${r.userId}> ➔ ${state} (Vence: \`${expDate}\`) | [${plats}]`;
          });

          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📋 Revendedores de ${interaction.guild?.name || 'este servidor'}`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'Panel Administrativo • Auth Gateway' })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        if (customId === 'admin_btn_config_platforms') {
          return showPlatformsConfigMenu(interaction, interaction.guildId, db);
        }

        if (customId === 'admin_btn_connect_voice') {
          await interaction.deferReply({ ephemeral: true });
          const guild = interaction.guild;
          if (!guild) {
            return interaction.editReply({ content: '❌ Este botón solo puede usarse dentro de un servidor.' });
          }
          const res = await connectToVoiceChannel(guild);
          if (res.success) {
            return interaction.editReply({
              content: `🔊 **¡Conectado exitosamente!**\nEl bot ahora está conectado al canal de voz **<#${res.channelId}>** (modo 24/7 activo en este servidor).`,
            });
          } else {
            return interaction.editReply({
              content: `❌ **No se pudo conectar al canal de voz:**\n${res.error}\n\n💡 *Tip: Puedes configurar o corregir el canal de voz usando \`/setup\` o desde el Dashboard Web.*`,
            });
          }
        }
      }

      // GENERAR KEY
      if (customId === 'btn_create_key') {
        if (!perms.isAdmin && (!perms.isReseller || perms.isExpired)) {
          const audit = getUserAuditInfo(member, user, config, guildId);
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0x64748b)
              .setTitle('[SEGURIDAD] Intento de Acción sin Membresía Activa')
              .addFields(
                { name: 'Operador', value: `<@${user.id}>`, inline: true },
                { name: 'Rango', value: audit.role, inline: true },
                { name: 'Membresía', value: audit.membership, inline: true },
                { name: 'Acción Intentada', value: 'Generar Clave', inline: false }
              )
              .setFooter({ text: 'Sistema de Seguridad • Auth Gateway' })
              .setTimestamp(),
            guildId
          );
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No estás registrado como revendedor (o tu membresía ha expirado).\nEl administrador debe activarte con `/revendedor asignar @usuario dias:<días> plataformas:<lista>`',
            ephemeral: true,
          });
        }

        if (perms.allowedProviders.length === 0) {
          return interaction.reply({
            content: '⛔ No tienes permisos asignados para ninguna plataforma. Contacta a un administrador.',
            ephemeral: true,
          });
        }

        // Si solo tiene acceso a 1 plataforma, abrir modal directo o selector de sub
        if (perms.allowedProviders.length === 1) {
          const onlyPid = perms.allowedProviders[0];
          if (onlyPid === 'mycheats') {
            const provider = providerManager.getForGuild('mycheats', interaction.guildId, db);
            const subs = await provider.getSubscriptions();
            const subOptions = subs.map((s) => ({
              label: s.name.slice(0, 100),
              value: String(s.id),
              description: `Crear cuenta con suscripción ${s.name}`.slice(0, 100),
            }));
            const subRow = new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('select_mycheats_sub')
                .setPlaceholder('Selecciona la suscripción de WorldCheats')
                .addOptions(subOptions)
            );
            return interaction.reply({
              content: '👤 **Selecciona el tipo de suscripción para WorldCheats:**',
              components: [subRow],
              ephemeral: true,
            });
          }

          const defaultPrefix = db.forGuild(interaction.guildId).getDefaultPrefix();
          return interaction.showModal(
            getCreateKeyModal(onlyPid, perms.maxDays, defaultPrefix)
          );
        }

        // Filtrar plataformas autorizadas con sus nombres y descripciones personalizadas del servidor
        const gMeta = db.getAllProvidersMetadata(interaction.guildId);
        const options = perms.allowedProviders.map((pid) => {
          const meta = gMeta[pid] || { name: pid, desc: `Generar en ${pid}` };
          return {
            label: meta.name.slice(0, 100),
            value: pid,
            description: (meta.desc || `Generar en ${meta.name}`).slice(0, 100),
          };
        });

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_create_provider')
            .setPlaceholder('Selecciona la plataforma autorizada')
            .addOptions(options)
        );

        return interaction.reply({
          content: '🔍 **Selecciona la plataforma web donde deseas crear la licencia:**',
          components: [selectRow],
          ephemeral: true,
        });
      }

      // ELIMINAR KEY
      if (customId === 'btn_delete_key') {
        if (!perms.isAdmin && (!perms.isReseller || perms.isExpired)) {
          const audit = getUserAuditInfo(member, user, config, guildId);
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0x64748b)
              .setTitle('[SEGURIDAD] Intento de Acción sin Membresía Activa')
              .addFields(
                { name: 'Operador', value: `<@${user.id}>`, inline: true },
                { name: 'Rango', value: audit.role, inline: true },
                { name: 'Membresía', value: audit.membership, inline: true },
                { name: 'Acción Intentada', value: 'Eliminar Clave', inline: false }
              )
              .setFooter({ text: 'Sistema de Seguridad • Auth Gateway' })
              .setTimestamp(),
            guildId
          );
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes una membresía de revendedor activa.',
            ephemeral: true,
          });
        }

        if (perms.allowedProviders.length === 0) {
          return interaction.reply({
            content: '⛔ No tienes permisos para eliminar licencias.',
            ephemeral: true,
          });
        }

        if (perms.allowedProviders.length === 1) {
          return interaction.showModal(
            getDeleteKeyModal(perms.allowedProviders[0])
          );
        }

        const options = perms.allowedProviders.map((pid) => ({
          label: providerManager.get(pid)?.name || pid,
          value: pid,
        }));

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_delete_provider')
            .setPlaceholder('Selecciona la plataforma')
            .addOptions(options)
        );

        return interaction.reply({
          content: 'Selecciona la plataforma de la clave que deseas eliminar:',
          components: [selectRow],
          ephemeral: true,
        });
      }

      // RESET HWID
      if (customId === 'btn_reset_hwid') {
        if (!perms.isAdmin && (!perms.isReseller || perms.isExpired)) {
          const audit = getUserAuditInfo(member, user, config, guildId);
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0x64748b)
              .setTitle('[SEGURIDAD] Intento de Acción sin Membresía Activa')
              .addFields(
                { name: 'Operador', value: `<@${user.id}>`, inline: true },
                { name: 'Rango', value: audit.role, inline: true },
                { name: 'Membresía', value: audit.membership, inline: true },
                { name: 'Acción Intentada', value: 'Restablecer HWID', inline: false }
              )
              .setFooter({ text: 'Sistema de Seguridad • Auth Gateway' })
              .setTimestamp(),
            guildId
          );
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes una membresía de revendedor activa.',
            ephemeral: true,
          });
        }

        if (perms.allowedProviders.length === 0) {
          return interaction.reply({
            content: '⛔ No tienes permisos para resetear HWID.',
            ephemeral: true,
          });
        }

        if (perms.allowedProviders.length === 1) {
          return interaction.showModal(
            getResetHwidModal(perms.allowedProviders[0])
          );
        }

        const options = perms.allowedProviders.map((pid) => ({
          label: providerManager.get(pid)?.name || pid,
          value: pid,
        }));

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_reset_provider')
            .setPlaceholder('Selecciona la plataforma')
            .addOptions(options)
        );

        return interaction.reply({
          content: 'Selecciona la plataforma de la clave a resetear HWID:',
          components: [selectRow],
          ephemeral: true,
        });
      }

      // MIS LICENCIAS (Panel personal)
      if (customId === 'btn_my_keys') {
        const gId = interaction.guildId || config.discord.guildId;
        const userKeys = db.getUserKeys(user.id, 15, gId);
        if (userKeys.length === 0) {
          return interaction.reply({
            content: `ℹ️ Aún no has generado ninguna licencia en **${interaction.guild?.name || 'este servidor'}**.`,
            ephemeral: true,
          });
        }

        const gMeta = db.getAllProvidersMetadata(gId);
        const lines = userKeys.map(
          (k, idx) =>
            `${idx + 1}. \`${k.key}\` (${k.days}d) - **${gMeta[k.providerId]?.name || k.providerId}**`
        );

        const options = userKeys.slice(0, 15).map((k) => ({
          label: k.key.length > 25 ? `${k.key.substring(0, 22)}...` : k.key,
          value: `${k.providerId}|${k.key}`,
          description: `${k.days}d - ${gMeta[k.providerId]?.name || k.providerId}`,
        }));

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_quick_hwid_reset')
            .setPlaceholder('🔄 Selecciona una clave para Resetear HWID')
            .addOptions(options)
        );

        const embed = new EmbedBuilder()
          .setColor(0x00a8ff)
          .setTitle('📋 Tus Licencias Generadas (Panel Personal)')
          .setDescription(
            lines.join('\n') +
              '\n\n💡 *Selecciona una de tus claves abajo para resetear su HWID de inmediato:*'
          )
          .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          components: [selectRow],
          ephemeral: true,
        });
      }

      // MI MEMBRESÍA
      if (customId === 'btn_my_membership') {
        let statusDesc = '';
        if (perms.isAdmin) {
          statusDesc = '👑 **Rango:** `Administrador / Dueño` (Acceso Total Permanente)';
        } else if (perms.isReseller) {
          if (perms.isExpired) {
            statusDesc = '🔴 **Membresía:** `Expirada` (Contacta al dueño para renovar)';
          } else {
            const expDate = new Date(perms.expiresAt).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            });
            statusDesc = `🟢 **Membresía Activa:** **${perms.daysLeft} días restantes**\n📅 **Fecha de vencimiento:** \`${expDate}\``;
          }
        } else {
          statusDesc = '⛔ **Estado:** No tienes membresía de revendedor activa';
        }

        const embed = new EmbedBuilder()
          .setColor(perms.isExpired ? 0xe74c3c : 0x9b59b6)
          .setTitle('📄 Estado de tu Membresía de Revendedor')
          .setDescription(
            `👤 **Usuario:** <@${user.id}>\n\n` +
              `${statusDesc}\n\n` +
              `🌐 **Plataformas autorizadas:**\n\`${perms.allowedProviders.join(', ') || 'Ninguna'}\``
          )
          .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    // 3. SELECT MENUS
    if (interaction.isStringSelectMenu()) {
      const { customId, values, member, user } = interaction;
      const perms = db.getUserPermissions(member, config, interaction.guildId);

      if (customId === 'select_config_platforms') {
        if (!perms.isAdmin) {
          return interaction.reply({
            content: '⛔ Solo administradores pueden configurar las plataformas.',
            ephemeral: true,
          });
        }

        const selected = values;
        db.setEnabledProviders(interaction.guildId, selected);

        db.recordWebAuditLog(interaction.guildId, {
          operatorTag: user.tag || user.username,
          operatorId: user.id,
          action: 'UPDATE_PLATFORMS',
          details: `Plataformas actualizadas en Discord: ${selected.join(', ')}`,
        });

        const cfg = db.getGuildConfig(interaction.guildId);
        const panelChanId = cfg.channels?.panelChannelId;
        if (panelChanId) {
          try {
            const ch = await interaction.client.channels.fetch(panelChanId);
            if (ch?.isTextBased()) {
              const msgs = await ch.messages.fetch({ limit: 15 });
              const existingPanel = msgs.find(m => m.author.id === interaction.client.user.id && m.embeds.some(e => e.title?.includes('SISTEMA DE LICENCIAS')));
              if (existingPanel) {
                await existingPanel.edit(createPanelPayload(interaction.guildId, db));
              }
            }
          } catch (_) {}
        }

        const names = selected.map(p => `• **${PROVIDER_NAMES[p] || p}**`).join('\n');
        return interaction.update({
          content: `✅ **Páginas web actualizadas correctamente para este servidor:**\n${names}\n\n*(El panel de licencias de este servidor se ha actualizado en tiempo real).*`,
          embeds: [],
          components: [],
        });
      }

      if (customId === 'select_create_provider') {
        const selectedProvider = values[0];
        if (!perms.allowedProviders.includes(selectedProvider) && !perms.isAdmin) {
          return interaction.reply({
            content: '⛔ No tienes acceso a esta plataforma.',
            ephemeral: true,
          });
        }

        if (selectedProvider === 'mycheats') {
          const provider = providerManager.getForGuild('mycheats', interaction.guildId, db);
          const subs = await provider.getSubscriptions();
          const subOptions = subs.map((s) => ({
            label: s.name.slice(0, 100),
            value: String(s.id),
            description: `Crear cuenta con suscripción ${s.name}`.slice(0, 100),
          }));
          const subRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('select_mycheats_sub')
              .setPlaceholder('Selecciona la suscripción de WorldCheats')
              .addOptions(subOptions)
          );
          return interaction.update({
            content: '👤 **Selecciona el tipo de suscripción para WorldCheats:**',
            components: [subRow],
          });
        }

        const defaultPrefix = db.forGuild(interaction.guildId).getDefaultPrefix();
        return interaction.showModal(
          getCreateKeyModal(selectedProvider, perms.maxDays, defaultPrefix)
        );
      }

      if (customId === 'select_mycheats_sub') {
        if (!perms.allowedProviders.includes('mycheats') && !perms.isAdmin) {
          return interaction.reply({
            content: '⛔ No tienes acceso a esta plataforma.',
            ephemeral: true,
          });
        }
        const chosenSubId = values[0];
        const provider = providerManager.getForGuild('mycheats', interaction.guildId, db);
        const subs = await provider.getSubscriptions();
        const foundSub = subs.find((s) => String(s.id) === String(chosenSubId));
        const subName = foundSub ? foundSub.name : '';
        const defaultPrefix = db.forGuild(interaction.guildId).getDefaultPrefix();
        return interaction.showModal(
          getCreateKeyModal('mycheats', perms.maxDays, defaultPrefix, chosenSubId, subName)
        );
      }

      if (customId === 'select_delete_provider') {
        const selectedProvider = values[0];
        if (!perms.isAdmin && (!perms.isReseller || perms.isExpired)) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes una membresía de revendedor activa.',
            ephemeral: true,
          });
        }
        if (!perms.isAdmin && !perms.allowedProviders.includes(selectedProvider)) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes acceso a esta plataforma.',
            ephemeral: true,
          });
        }
        return interaction.showModal(getDeleteKeyModal(selectedProvider));
      }

      if (customId === 'select_reset_provider') {
        const selectedProvider = values[0];
        if (!perms.isAdmin && (!perms.isReseller || perms.isExpired)) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes una membresía de revendedor activa.',
            ephemeral: true,
          });
        }
        if (!perms.isAdmin && !perms.allowedProviders.includes(selectedProvider)) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes acceso a esta plataforma.',
            ephemeral: true,
          });
        }
        return interaction.showModal(getResetHwidModal(selectedProvider));
      }

      // Reset rápido de HWID desde el panel personal
      if (customId === 'select_quick_hwid_reset') {
        const gId = interaction.guildId || config.discord.guildId;
        if (!perms.isAdmin && (!perms.isReseller || perms.isExpired)) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes una membresía de revendedor activa.',
            ephemeral: true,
          });
        }

        const [providerId, key] = values[0].split('|');
        const provider = providerManager.getForGuild(providerId, gId, db);

        if (!perms.isAdmin && !perms.allowedProviders.includes(providerId)) {
          return interaction.reply({
            content: '⛔ No tienes permiso para gestionar esta plataforma.',
            ephemeral: true,
          });
        }

        // Validar propiedad de la clave si no es admin
        const keyRecord = db.findKey(key, gId);
        if (!perms.isAdmin && keyRecord && keyRecord.userId !== user.id) {
          return interaction.reply({
            content: '⛔ Solo puedes resetear el HWID de claves que tú mismo has generado.',
            ephemeral: true,
          });
        }

        await interaction.deferReply({ ephemeral: true });
        try {
          const result = await provider.resetHwid(key);
          await interaction.editReply({
            content: `✅ **HWID Reseteado Exitosamente:**\n• Clave: \`${key}\`\n• Plataforma: **${provider.name}**\n• Detalle: ${result}`,
          });

          const audit = getUserAuditInfo(member, user, config, gId);
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xd97706)
              .setTitle('[AUDITORÍA] Restablecimiento de HWID')
              .addFields(
                { name: 'Operador', value: `<@${user.id}>`, inline: true },
                { name: 'Rango', value: audit.role, inline: true },
                { name: 'Membresía', value: audit.membership, inline: true },
                { name: 'Plataforma', value: provider.name, inline: true },
                { name: 'Clave / Licencia', value: `\`${key}\``, inline: false },
                { name: 'Método', value: 'Selección Rápida (Mis Licencias)', inline: false }
              )
              .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
              .setTimestamp(),
            gId
          );
        } catch (err) {
          await interaction.editReply({
            content: `❌ Error al resetear HWID: ${err.message}`,
          });
        }
      }

      // Selección de plataformas con checks al asignar
      if (customId.startsWith('select_admin_assign_platforms_')) {
        if (!perms.isAdmin) {
          return interaction.reply({
            content: '⛔ Solo administradores pueden realizar esta acción.',
            ephemeral: true,
          });
        }

        const parts = customId.split('_');
        const targetId = parts[4];
        const dias = parseInt(parts[5], 10);
        const limit = parts[6] ? parseInt(parts[6], 10) : 0;

        let platforms = [];
        const guildEnabled = db.getEnabledProviders(interaction.guildId);
        if (values.includes('all')) {
          platforms = guildEnabled;
        } else {
          platforms = values.filter((p) => guildEnabled.includes(p));
        }

        const res = db.setReseller(targetId, dias, platforms, user.tag, limit, interaction.guildId);
        const expDate = new Date(res.expiresAt).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });

        const platNames = res.allowedProviders.map((pid) => config.providers[pid]?.name || pid);

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('✅ Revendedor Configurado Exitosamente')
          .setDescription(
            `• **Usuario:** <@${targetId}>\n` +
              `• **Tiempo asignado:** +${dias} días\n` +
              `• **Días totales restantes:** **${res.daysLeft} días** (Vence: \`${expDate}\`)\n` +
              `• **Límite diario:** ${limit > 0 ? `**${limit} keys/día**` : '**Sin límite (Ilimitado)**'}\n` +
              `• **Plataformas autorizadas:**\n${platNames.map((n) => `  ☑️ **${n}**`).join('\n')}`
          )
          .setFooter({ text: 'Panel Administrativo • Auth Gateway' })
          .setTimestamp();

        const opAudit = getUserAuditInfo(member, user, config, interaction.guildId);
        const targetAudit = getUserAuditInfo(null, { id: targetId }, config, interaction.guildId);
        await logToAdminChannel(
          new EmbedBuilder()
            .setColor(0x16a34a)
            .setTitle('[ADMINISTRACIÓN] Asignación de Revendedor')
            .addFields(
              { name: 'Operador', value: `<@${user.id}>`, inline: true },
              { name: 'Rango Operador', value: opAudit.role, inline: true },
              { name: 'Revendedor Asignado', value: `<@${targetId}>`, inline: true },
              { name: 'Tiempo Otorgado', value: `+${dias} días`, inline: true },
              { name: 'Membresía Resultante', value: targetAudit.membership, inline: true },
              { name: 'Límite Diario', value: limit > 0 ? `${limit} keys/día` : 'Sin límite', inline: true },
              { name: 'Plataformas Autorizadas', value: platNames.join(', '), inline: false }
            )
            .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
            .setTimestamp(),
          interaction.guildId
        );

        return interaction.update({
          content: '✅ **Membresía y plataformas configuradas con éxito.**',
          embeds: [embed],
          components: [],
        });
      }

      // Selección de plataformas con checks al modificar
      if (customId.startsWith('select_admin_edit_platforms_')) {
        if (!perms.isAdmin) {
          return interaction.reply({
            content: '⛔ Solo administradores pueden realizar esta acción.',
            ephemeral: true,
          });
        }

        const parts = customId.split('_');
        const targetId = parts[4];

        let platforms = [];
        const guildEnabled = db.getEnabledProviders(interaction.guildId);
        if (values.includes('all')) {
          platforms = guildEnabled;
        } else {
          platforms = values.filter((p) => guildEnabled.includes(p));
        }

        const currentRes = db.getReseller(targetId, interaction.guildId);
        if (currentRes) {
          db.forGuild(interaction.guildId).setReseller(targetId, 0, platforms, user.tag, currentRes.dailyLimit);
        }

        const platNames = platforms.map((pid) => config.providers[pid]?.name || pid);

        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle('🔐 Permisos Actualizados Exitosamente')
          .setDescription(
            `Se han actualizado las plataformas permitidas para <@${targetId}>:\n\n` +
              `${platNames.map((n) => `☑️ **${n}**`).join('\n')}`
          )
          .setFooter({ text: 'Panel Administrativo • Auth Gateway' })
          .setTimestamp();

        const opAudit = getUserAuditInfo(member, user, config, interaction.guildId);
        const targetAudit = getUserAuditInfo(null, { id: targetId }, config, interaction.guildId);
        await logToAdminChannel(
          new EmbedBuilder()
            .setColor(0x2563eb)
            .setTitle('[ADMINISTRACIÓN] Modificación de Permisos')
            .addFields(
              { name: 'Operador', value: `<@${user.id}>`, inline: true },
              { name: 'Rango Operador', value: opAudit.role, inline: true },
              { name: 'Revendedor', value: `<@${targetId}>`, inline: true },
              { name: 'Membresía Actual', value: targetAudit.membership, inline: true },
              { name: 'Plataformas Autorizadas', value: platNames.join(', '), inline: false }
            )
            .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
            .setTimestamp(),
          interaction.guildId
        );

        return interaction.update({
          content: '✅ **Permisos de plataformas actualizados.**',
          embeds: [embed],
          components: [],
        });
      }
    }

    // 4. SUBMIT DE MODALS (Formularios)
    if (interaction.isModalSubmit()) {
      const { customId, member, user, guildId } = interaction;
      const perms = db.getUserPermissions(member, config, guildId);

      // ── MODALES DEL PANEL ADMINISTRATIVO ──
      if (customId === 'modal_admin_assign_reseller') {
        if (!perms.isAdmin) {
          return interaction.reply({
            content: '⛔ Solo administradores pueden realizar esta acción.',
            ephemeral: true,
          });
        }

        const rawUser = interaction.fields.getTextInputValue('input_admin_target_user');
        const targetId = extractUserId(rawUser);

        if (!targetId) {
          return interaction.reply({
            content: '❌ No se pudo identificar al usuario. Por favor ingresa su ID de Discord (números) o menciónalo como @usuario.',
            ephemeral: true,
          });
        }

        const dias = parseInt(interaction.fields.getTextInputValue('input_admin_reseller_days'), 10);
        if (isNaN(dias) || dias <= 0) {
          return interaction.reply({
            content: '❌ Días inválidos. Ingresa un número mayor a 0 (ej: 30).',
            ephemeral: true,
          });
        }

        let limit = 0;
        try {
          limit = parseInt(interaction.fields.getTextInputValue('input_admin_reseller_limit') || '0', 10);
          if (isNaN(limit) || limit < 0) limit = 0;
        } catch {
          limit = 0;
        }

        const serverEnabled = db.getEnabledProviders(interaction.guildId);
        const platformOptions = [
          {
            label: '🌟 TODAS LAS PLATAFORMAS (De este servidor)',
            value: 'all',
            description: 'Otorga acceso a las plataformas activas en este servidor',
          },
          ...Object.entries(config.providers)
            .filter(([pid]) => serverEnabled.includes(pid))
            .map(([pid, p]) => ({
              label: p.name,
              value: pid,
              description: `Habilitar acceso a ${p.name}`,
            })),
        ];

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`select_admin_assign_platforms_${targetId}_${dias}_${limit}`)
            .setPlaceholder('Marca las casillas de las plataformas permitidas...')
            .setMinValues(1)
            .setMaxValues(platformOptions.length)
            .addOptions(platformOptions)
        );

        return interaction.reply({
          content: `👤 **Configurando membresía para <@${targetId}> (+${dias} días)**\n` +
            `👉 Selecciona una o varias plataformas marcando los checks a continuación:`,
          components: [selectRow],
          ephemeral: true,
        });
      }

      if (customId === 'modal_admin_edit_perms') {
        if (!perms.isAdmin) {
          return interaction.reply({
            content: '⛔ Solo administradores pueden realizar esta acción.',
            ephemeral: true,
          });
        }

        const rawUser = interaction.fields.getTextInputValue('input_admin_target_user');
        const targetId = extractUserId(rawUser);

        if (!targetId) {
          return interaction.reply({
            content: '❌ No se pudo identificar al usuario. Ingresa su ID o mención.',
            ephemeral: true,
          });
        }

        const current = db.getReseller(targetId, guildId);
        if (!current) {
          return interaction.reply({
            content: `⚠️ El usuario <@${targetId}> no está registrado como revendedor en este servidor. Primero asígnale tiempo con **Asignar Revendedor**.`,
            ephemeral: true,
          });
        }

        const serverEnabled = db.getEnabledProviders(guildId);
        const gMeta = db.getAllProvidersMetadata(guildId);
        const platformOptions = [
          {
            label: '🌟 TODAS LAS PLATAFORMAS (De este servidor)',
            value: 'all',
            description: 'Otorga acceso a las plataformas activas en este servidor',
          },
          ...serverEnabled.map((pid) => {
            const m = gMeta[pid] || { name: pid, desc: '' };
            return {
              label: m.name.slice(0, 100),
              value: pid,
              description: (m.desc || `Habilitar acceso a ${m.name}`).slice(0, 100),
            };
          }),
        ];

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`select_admin_edit_platforms_${targetId}`)
            .setPlaceholder('Marca o desmarca las plataformas deseadas...')
            .setMinValues(1)
            .setMaxValues(platformOptions.length)
            .addOptions(platformOptions)
        );

        return interaction.reply({
          content: `🔐 **Modificando plataformas para <@${targetId}>**\n` +
            `Plataformas actuales: \`${current.allowedProviders.join(', ') || 'Ninguna'}\`\n` +
            `👉 Marca las casillas de las plataformas que tendrá permitidas a partir de ahora:`,
          components: [selectRow],
          ephemeral: true,
        });
      }

      if (customId === 'modal_admin_remove_reseller') {
        if (!perms.isAdmin) {
          return interaction.reply({
            content: '⛔ Solo administradores pueden realizar esta acción.',
            ephemeral: true,
          });
        }

        const rawUser = interaction.fields.getTextInputValue('input_admin_target_user');
        const targetId = extractUserId(rawUser);

        if (!targetId) {
          return interaction.reply({
            content: '❌ No se pudo identificar al usuario. Ingresa su ID o mención.',
            ephemeral: true,
          });
        }

        const removed = db.removeReseller(targetId, interaction.guildId);

        if (removed) {
          const opAudit = getUserAuditInfo(member, user, config, interaction.guildId);
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xdc2626)
              .setTitle('[ADMINISTRACIÓN] Revocación de Revendedor')
              .addFields(
                { name: 'Operador', value: `<@${user.id}>`, inline: true },
                { name: 'Rango Operador', value: opAudit.role, inline: true },
                { name: 'Revendedor Revocado', value: `<@${targetId}>`, inline: true },
                { name: 'Origen', value: 'Panel Administrativo Interactivo', inline: false }
              )
              .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
              .setTimestamp(),
            interaction.guildId
          );
        }

        return interaction.reply({
          content: removed
            ? `🗑️ Se ha revocado la membresía de revendedor para <@${targetId}>.`
            : `⚠️ El usuario <@${targetId}> no estaba registrado como revendedor.`,
          ephemeral: true,
        });
      }

      if (customId === 'modal_admin_info_reseller') {
        if (!perms.isAdmin) {
          return interaction.reply({
            content: '⛔ Solo administradores pueden realizar esta acción.',
            ephemeral: true,
          });
        }

        const rawUser = interaction.fields.getTextInputValue('input_admin_target_user');
        const targetId = extractUserId(rawUser);

        if (!targetId) {
          return interaction.reply({
            content: '❌ No se pudo identificar al usuario.',
            ephemeral: true,
          });
        }

        const res = db.getReseller(targetId, guildId);
        if (!res) {
          return interaction.reply({
            content: `ℹ️ El usuario <@${targetId}> no está registrado como revendedor en este servidor.`,
            ephemeral: true,
          });
        }

        const statusText = res.isExpired ? '🔴 Expirado' : `🟢 Activo (${res.daysLeft} días restantes)`;
        const expDate = new Date(res.expiresAt).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });

        const userKeys = db.getUserKeys(targetId, 100, guildId);
        const gMeta = db.getAllProvidersMetadata(guildId);
        const platNames = res.allowedProviders.map((pid) => gMeta[pid]?.name || pid).join(', ') || 'Ninguna';

        const embed = new EmbedBuilder()
          .setColor(res.isExpired ? 0xe74c3c : 0x00d2d3)
          .setTitle(`👤 Información de Revendedor: <@${targetId}>`)
          .setDescription(
            `• **Servidor:** ${interaction.guild?.name || 'Este Servidor'}\n` +
              `• **Usuario:** <@${targetId}> (\`${targetId}\`)\n` +
              `• **Estado:** ${statusText}\n` +
              `• **Fecha de Vencimiento:** \`${expDate}\`\n` +
              `• **Plataformas Autorizadas:** \`${platNames}\`\n` +
              `• **Total Licencias Emitidas en este servidor:** **${userKeys.length}**\n` +
              `• **Registrado por:** ${res.addedBy}`
          )
          .setFooter({ text: 'Panel Administrativo • Auth Gateway' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (customId === 'modal_admin_add_stock') {
        if (!perms.isAdmin) {
          return interaction.reply({
            content: '⛔ Solo administradores pueden realizar esta acción.',
            ephemeral: true,
          });
        }

        const providerId = (interaction.fields.getTextInputValue('input_admin_stock_provider') || 'keyauth').trim().toLowerCase();
        if (providerId !== 'keyauth') {
          return interaction.reply({
            content: '❌ **Solo KeyAuth (Elite Pro) requiere stock manual precargado.**\nLas demás plataformas (Bypass APK, Bypass UID y WorldCheats) generan sus licencias automáticamente vía API en tiempo real.',
            ephemeral: true,
          });
        }
        const dias = parseInt(interaction.fields.getTextInputValue('input_admin_stock_days') || '30', 10);
        const rawKeys = interaction.fields.getTextInputValue('input_admin_stock_keys');
        const keysList = rawKeys.split(/[\s,\n]+/).map((k) => k.trim()).filter((k) => k.length > 0);

        if (keysList.length === 0) {
          return interaction.reply({
            content: '❌ No se detectaron claves válidas en el texto ingresado.',
            ephemeral: true,
          });
        }

        const result = db.addStock(providerId, keysList, dias, interaction.guildId);
        const pMeta = db.getProviderMetadata(interaction.guildId, providerId);
        const pName = pMeta?.name || config.providers[providerId]?.name || providerId;

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('📦 Stock de Claves Actualizado')
          .setDescription(
            `• **Plataforma:** \`${pName}\`\n` +
              `• **Claves añadidas:** **+${result.added}**\n` +
              `• **Duración configurada:** **${dias} días**\n` +
              `• **Stock total disponible:** **${result.total} claves**`
          )
          .setFooter({ text: 'Panel Administrativo • Auth Gateway' })
          .setTimestamp();

        const opAudit = getUserAuditInfo(member, user, config, interaction.guildId);
        await logToAdminChannel(
          new EmbedBuilder()
            .setColor(0x16a34a)
            .setTitle('[STOCK] Recarga de Inventario')
            .addFields(
              { name: 'Operador', value: `<@${user.id}>`, inline: true },
              { name: 'Rango Operador', value: opAudit.role, inline: true },
              { name: 'Plataforma', value: pName, inline: true },
              { name: 'Claves Añadidas', value: `+${result.added} claves`, inline: true },
              { name: 'Duración por Clave', value: `${dias} días`, inline: true },
              { name: 'Stock Total Disponible', value: `${result.total} claves`, inline: true }
            )
            .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
            .setTimestamp(),
          interaction.guildId
        );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // CREAR KEY
      if (customId.startsWith('modal_create_')) {
        const gId = interaction.guildId || config.discord.guildId;
        const rawTarget = customId.replace('modal_create_', '');
        let providerId = rawTarget;
        let chosenSubId = null;
        if (rawTarget.startsWith('mycheats_')) {
          chosenSubId = rawTarget.replace('mycheats_', '');
          providerId = 'mycheats';
        }
        const provider = providerManager.getForGuild(providerId, gId, db);

        if (!perms.isAdmin && (!perms.isReseller || perms.isExpired)) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** Tu membresía de revendedor no está activa o ha expirado.',
            ephemeral: true,
          });
        }

        if (!perms.isAdmin && !perms.allowedProviders.includes(providerId)) {
          return interaction.reply({
            content: '⛔ No tienes permiso para generar en esta plataforma.',
            ephemeral: true,
          });
        }

        if (!provider) {
          return interaction.reply({
            content: '❌ Proveedor web no disponible.',
            ephemeral: true,
          });
        }

        let days = parseInt(interaction.fields.getTextInputValue('input_days') || '30', 10);
        let count = 1;
        let prefix = '';
        let note = '';

        try {
          count = parseInt(interaction.fields.getTextInputValue('input_count') || '1', 10);
        } catch {
          count = 1;
        }

        try {
          note = (interaction.fields.getTextInputValue('input_note') || '').trim();
        } catch {
          note = '';
        }

        if (providerId !== 'keyauth') {
          try {
            prefix = (interaction.fields.getTextInputValue('input_prefix') || '').trim();
          } catch {
            prefix = '';
          }
        }

        if (isNaN(days) || days <= 0 || (!perms.isAdmin && days > perms.maxDays)) {
          return interaction.reply({
            content: `❌ Duración inválida. Debe ser un número entre 1 y ${perms.maxDays} días.`,
            ephemeral: true,
          });
        }

        if (isNaN(count) || count < 1 || count > 5) {
          return interaction.reply({
            content: '❌ La cantidad de keys debe ser entre 1 y 5.',
            ephemeral: true,
          });
        }

        // 1. Verificación Anti-Flood (Protección contra ráfagas aceleradas)
        const floodCheck = db.forGuild(gId).checkAntiFlood(user.id);
        if (!floodCheck.allowed) {
          if (floodCheck.triggeredCooldown) {
            await logToGuildAdminChannel(
              interaction.guild,
              new EmbedBuilder()
                .setColor(0xef4444)
                .setTitle('🚨 [SEGURIDAD] Detección de Flood en Discord')
                .setDescription('Se ha detectado una ráfaga excesiva de emisión (>3 intentos en menos de 2 minutos).')
                .addFields(
                  { name: 'Usuario / Revendedor', value: `<@${user.id}> (${user.tag})`, inline: true },
                  { name: 'Plataforma Solicitada', value: provider.name, inline: true },
                  { name: 'Acción Aplicada', value: 'Enfriamiento temporal de 10 minutos activado automáticamente.', inline: false }
                )
                .setFooter({ text: 'Sistema de Seguridad Anti-Flood • Auth Gateway' })
                .setTimestamp(),
              gId
            );
            return interaction.reply({
              content: `🚨 **ALERTA DE SEGURIDAD (Anti-Flood):** Has emitido solicitudes con demasiada rapidez. Se ha activado un enfriamiento temporal de **${floodCheck.cooldownMinutes} minutos** en tu cuenta.`,
              ephemeral: true,
            });
          }
          return interaction.reply({
            content: `⏳ **Enfriamiento Activo:** Debes esperar **${floodCheck.remainingMinutes || 1} minuto(s)** antes de volver a emitir licencias.`,
            ephemeral: true,
          });
        }

        // 2. Verificación de Cuota Diaria (Daily Quotas)
        const quotaCheck = db.forGuild(gId).checkResellerQuota(user.id, count);
        if (!quotaCheck.allowed) {
          if (quotaCheck.quotaExceeded) {
            return interaction.reply({
              content: `⛔ **Límite Diario Alcanzado:** Has alcanzado tu cuota de **${quotaCheck.dailyLimit} licencias por día** (usadas hoy: **${quotaCheck.usedToday}**). Podrás emitir más mañana.`,
              ephemeral: true,
            });
          }
          return interaction.reply({
            content: `⛔ ${quotaCheck.error || 'No tienes permiso para emitir licencias.'}`,
            ephemeral: true,
          });
        }

        await interaction.deferReply({ ephemeral: true });

        const serverPrefix = db.forGuild(gId).getDefaultPrefix();
        const finalPrefix = (prefix && prefix.trim()) ? prefix.trim() : (providerId === 'mycheats' ? (serverPrefix || 'USER') : serverPrefix);

        try {
          console.log(`[Discord Keys] Emisión en guild ${gId} (${providerId}${chosenSubId ? ' sub:' + chosenSubId : ''}) por @${user.tag} - Cuenta: "${provider.config?.username || provider.config?.sellerKey || 'Default'}"`);
          const items = await provider.createKey({
            days,
            count,
            prefix: finalPrefix,
            note,
            subId: chosenSubId,
          });

          // Registrar en Anti-Flood y Cuota Diaria
          db.forGuild(gId).recordKeyBurst(user.id);
          db.forGuild(gId).incrementResellerUsage(user.id, count);

          // Registrar en BD del servidor
          for (const item of items) {
            const keyValue = typeof item === 'object' ? item.key : item;
            const itemDays = typeof item === 'object' && item.days ? item.days : days;
            db.recordKey({
              userId: user.id,
              providerId,
              key: keyValue,
              days: itemDays,
              prefix: finalPrefix,
              note,
              subId: typeof item === 'object' && item.subId ? item.subId : chosenSubId,
              subName: typeof item === 'object' && item.subName ? item.subName : undefined,
            }, gId);
          }

          // Plantillas de Reenvío para WhatsApp con el nombre personalizado del servidor
          const pMeta = db.getProviderMetadata(gId, providerId);
          const pDisplayName = pMeta?.name || provider.name;

          const forwardTemplates = items
            .map((item) => {
              const val = typeof item === 'object' ? (item.username ? `${item.username}:1` : item.key) : item;
              const itemDays = typeof item === 'object' && item.days ? item.days : days;
              const itemSubName = typeof item === 'object' && item.subName ? item.subName : '';
              return getForwardTemplate({
                providerName: pDisplayName,
                keyOrUser: val,
                days: itemDays,
                isAccount: providerId === 'mycheats',
                subName: itemSubName,
                guildId: gId,
              });
            })
            .join('\n');

          const firstSubName = items[0] && typeof items[0] === 'object' && items[0].subName ? items[0].subName : '';
          const displayHeader = firstSubName ? `${pDisplayName} • ${firstSubName}` : pDisplayName;

          const successEmbed = new EmbedBuilder()
            .setColor(0x00d2d3)
            .setTitle(`✅ ${providerId === 'mycheats' ? 'Cuenta Creada' : 'Licencia Creada'} (${displayHeader})`)
            .setDescription(
              `Copia el siguiente recuadro para enviarlo directamente a tu cliente por WhatsApp:\n\n` +
                forwardTemplates +
                `\n💡 *Respuesta privada. También puedes ver tus claves en el botón **Mis Licencias**.*`
            )
            .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
            .setTimestamp();

          await interaction.editReply({ embeds: [successEmbed] });

          // Log de auditoría
          const opAudit = getUserAuditInfo(member, user, config, gId);
          const isVipAccount = providerId === 'mycheats';
          const title = isVipAccount ? '[AUDITORÍA] Creación de Cuenta VIP' : '[AUDITORÍA] Emisión de Licencia';

          const logFields = [
            { name: 'Operador', value: `<@${user.id}>`, inline: true },
            { name: 'Rango', value: opAudit.role, inline: true },
            { name: 'Membresía', value: opAudit.membership, inline: true },
            { name: 'Plataforma', value: provider.name, inline: true },
          ];
          if (firstSubName) {
            logFields.push({ name: 'Suscripción', value: firstSubName, inline: true });
          }
          logFields.push(
            { name: 'Duración', value: `${days} días`, inline: true },
            { name: 'Cantidad', value: `${count} unidad(es)`, inline: true },
            {
              name: isVipAccount ? 'Cuentas Generadas' : 'Claves Generadas',
              value: items
                .map((k) => (typeof k === 'object' ? (k.username ? `||\`${k.username}:1\`||` : `||\`${k.key}\`||`) : `||\`${k}\`||`))
                .join('\n'),
              inline: false,
            },
            { name: 'Cliente / Nota', value: note || 'Sin nota registrada', inline: false }
          );

          const logEmbed = new EmbedBuilder()
            .setColor(0x2563eb)
            .setTitle(title)
            .addFields(logFields)
            .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
            .setTimestamp();

          await logToAdminChannel(logEmbed, gId);
        } catch (err) {
          console.error('[Error Create Key]', err);
          await interaction.editReply({
            content: `❌ **Error al generar:**\n${err.message}`,
          });
        }
      }

      // ELIMINAR KEY
      if (customId.startsWith('modal_delete_')) {
        const gId = interaction.guildId || config.discord.guildId;
        const providerId = customId.replace('modal_delete_', '');
        const provider = providerManager.getForGuild(providerId, gId, db);
        const key = interaction.fields.getTextInputValue('input_key').trim();

        if (!perms.isAdmin && (!perms.isReseller || perms.isExpired)) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes una membresía de revendedor activa.',
            ephemeral: true,
          });
        }

        if (!perms.isAdmin && !perms.allowedProviders.includes(providerId)) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes permiso para esta plataforma.',
            ephemeral: true,
          });
        }

        // Si no es admin, solo puede eliminar claves que él mismo generó
        if (!perms.isAdmin) {
          const keyRecord = db.findKey(key, gId);
          if (!keyRecord || keyRecord.userId !== user.id) {
            return interaction.reply({
              content: '⛔ **Acceso denegado:** Esta clave no existe o no fue generada por ti. No puedes eliminar claves ajenas.',
              ephemeral: true,
            });
          }
        }

        await interaction.deferReply({ ephemeral: true });
        try {
          const result = await provider.deleteKey(key);
          await interaction.editReply({
            content: `🗑️ **Resultado:** ${result}`,
          });

          const opAudit = getUserAuditInfo(member, user, config, gId);
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xdc2626)
              .setTitle('[AUDITORÍA] Revocación de Licencia')
              .addFields(
                { name: 'Operador', value: `<@${user.id}>`, inline: true },
                { name: 'Rango', value: opAudit.role, inline: true },
                { name: 'Membresía', value: opAudit.membership, inline: true },
                { name: 'Plataforma', value: provider.name, inline: true },
                { name: 'Clave Eliminada', value: `\`${key}\``, inline: false }
              )
              .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
              .setTimestamp(),
            gId
          );
        } catch (err) {
          await interaction.editReply({
            content: `❌ **Error al eliminar:** ${err.message}`,
          });
        }
      }

      // RESET HWID
      if (customId.startsWith('modal_reset_')) {
        const gId = interaction.guildId || config.discord.guildId;
        const providerId = customId.replace('modal_reset_', '');
        const provider = providerManager.getForGuild(providerId, gId, db);
        const key = interaction.fields.getTextInputValue('input_key').trim();

        if (!perms.isAdmin && (!perms.isReseller || perms.isExpired)) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes una membresía de revendedor activa.',
            ephemeral: true,
          });
        }

        if (!perms.isAdmin && !perms.allowedProviders.includes(providerId)) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes permiso para esta plataforma.',
            ephemeral: true,
          });
        }

        // Si no es admin, solo puede resetear claves que él mismo generó
        if (!perms.isAdmin) {
          const keyRecord = db.findKey(key, gId);
          if (!keyRecord || keyRecord.userId !== user.id) {
            return interaction.reply({
              content: '⛔ **Acceso denegado:** Esta clave no existe o no fue generada por ti. No puedes resetear claves ajenas.',
              ephemeral: true,
            });
          }
        }

        await interaction.deferReply({ ephemeral: true });
        try {
          const result = await provider.resetHwid(key);
          await interaction.editReply({
            content: `🔄 **Resultado:** ${result}`,
          });

          const opAudit = getUserAuditInfo(member, user, config, gId);
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xd97706)
              .setTitle('[AUDITORÍA] Restablecimiento de HWID')
              .addFields(
                { name: 'Operador', value: `<@${user.id}>`, inline: true },
                { name: 'Rango', value: opAudit.role, inline: true },
                { name: 'Membresía', value: opAudit.membership, inline: true },
                { name: 'Plataforma', value: provider.name, inline: true },
                { name: 'Clave / Licencia', value: `\`${key}\``, inline: false },
                { name: 'Detalle', value: `${result}`, inline: false }
              )
              .setFooter({ text: 'Sistema de Auditoría • Auth Gateway' })
              .setTimestamp(),
            gId
          );
        } catch (err) {
          await interaction.editReply({
            content: `❌ **Error al resetear HWID:** ${err.message}`,
          });
        }
      }
    }
  } catch (err) {
    console.error('[Error Interaction]', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `❌ Ocurrió un error inesperado: ${err.message}`,
        ephemeral: true,
      });
    }
  }
});

// Iniciar bot
client.login(config.discord.token).catch((err) => {
  console.error('[Discord] Error fatal al conectar el bot:', err);
});
