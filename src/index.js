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
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');

const config = require('./config');
const db = require('./database');
const providerManager = require('./providers');
const { createPanelPayload, createAdminPanelPayload } = require('./discord/panel');
const {
  getCreateKeyModal,
  getDeleteKeyModal,
  getResetHwidModal,
  getAdminAssignResellerModal,
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

// Log a canal de auditoría
async function logToAdminChannel(embed) {
  if (!config.discord.logsChannelId) return;
  try {
    const channel = await client.channels.fetch(config.discord.logsChannelId);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('[Logs] Error al enviar log:', err.message);
  }
}

// Evento Ready
client.once(Events.ClientReady, async () => {
  console.log(`\n========================================`);
  console.log(`[Bot Online] Conectado como: ${client.user.tag}`);
  console.log(`========================================\n`);

  const guild = client.guilds.cache.get(config.discord.guildId);

  if (!guild) {
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&permissions=8&scope=bot%20applications.commands`;
    console.warn(`[Aviso] El bot todavía no está unido a tu servidor.`);
    console.warn(`👉 Invita al bot usando este enlace:\n${inviteLink}\n`);
    return;
  }

  console.log(`[Servidor Encontrado] Conectado a: ${guild.name} (${guild.id})`);
  await registerSlashCommands();
  await checkAndPostPanel(guild);
  await checkAndPostAdminPanel(guild);
  connectToVoiceChannel(guild);

  // Log administrativo de encendido
  const allStock = db.getAllStock();
  const keyauthStock = allStock.keyauth || 0;
  await logToAdminChannel(
    new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🟢 [SISTEMA INICIADO] Bot en Línea')
      .setDescription(
        `• **Tag:** \`${client.user.tag}\`\n` +
          `• **Servidor:** \`${guild.name}\`\n` +
          `• **Canal de Voz:** <#${config.discord.voiceChannelId}>\n` +
          `• **Stock KeyAuth:** \`${keyauthStock} claves disponibles\`\n` +
          `• **Versión:** \`Auth Gateway v2.4 (Sparked Host Production)\``
      )
      .setFooter({ text: 'Monitor del Sistema' })
      .setTimestamp()
  );

  // Iniciar monitor periódico de salud
  startSystemMonitor(guild);
});

// Eventos de conexión de Discord (Desconexión / Reconexión)
client.on(Events.ShardDisconnect, async (event, id) => {
  console.warn(`[Discord] ⚠️ Desconectado del WebSocket (Shard ${id}).`);
  await logToAdminChannel(
    new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🔴 [DESCONEXIÓN] Bot Desconectado')
      .setDescription(`El bot perdió la conexión con Discord WebSocket (Shard ${id}). Intentando reconectar automáticamente...`)
      .setTimestamp()
  );
});

client.on(Events.ShardReconnecting, async (id) => {
  console.log(`[Discord] 🟡 Reconectando a Discord (Shard ${id})...`);
});

client.on(Events.ShardResume, async (id) => {
  console.log(`[Discord] 🟢 Conexión reanudada (Shard ${id}).`);
  await logToAdminChannel(
    new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🟢 [RECONEXIÓN EXITOSA] Bot Reanudado')
      .setDescription(`La conexión con Discord ha sido restablecida correctamente.`)
      .setTimestamp()
  );
});

// Cuando el bot sea invitado al servidor
client.on('guildCreate', async (guild) => {
  if (guild.id === config.discord.guildId) {
    console.log(`[Servidor Unido] El bot fue añadido a: ${guild.name}`);
    await registerSlashCommands();
    await checkAndPostPanel(guild);
    await checkAndPostAdminPanel(guild);
    connectToVoiceChannel(guild);
  }
});

let voiceReconnecting = false;
function connectToVoiceChannel(guild) {
  const voiceChannelId = config.discord.voiceChannelId;
  if (!voiceChannelId) return;

  try {
    const channel = guild.channels.cache.get(voiceChannelId);
    if (!channel) {
      console.warn(`[Voz] Canal de voz con ID ${voiceChannelId} no encontrado en el servidor.`);
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });

    connection.on(VoiceConnectionStatus.Ready, async () => {
      console.log(`[Voz] 🟢 Conectado exitosamente al canal de voz: ${channel.name} (${channel.id})`);
      if (voiceReconnecting) {
        voiceReconnecting = false;
        await logToAdminChannel(
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🟢 [VOZ RECONECTADA] Canal de Voz')
            .setDescription(`El bot se ha reconectado exitosamente al canal de voz <#${channel.id}>.`)
            .setTimestamp()
        );
      }
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.warn('[Voz] Conexión de voz desconectada. Reintentando en 5s...');
      voiceReconnecting = true;
      await logToAdminChannel(
        new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle('⚠️ [VOZ DESCONECTADA] Canal de Voz')
          .setDescription(`El bot se desconectó del canal de voz <#${voiceChannelId}>. Reintentando reconexión automática en 5 segundos...`)
          .setTimestamp()
      );
      setTimeout(() => connectToVoiceChannel(guild), 5000);
    });
  } catch (err) {
    console.error('[Voz] Error al conectar al canal de voz:', err.message);
  }
}

// Monitor Periódico de Salud del Sistema (cada 15 minutos)
let notifiedKeyauthLow = false;
function startSystemMonitor(guild) {
  setInterval(async () => {
    try {
      // 1. Verificar estado de las plataformas web
      const bypass = providerManager.get('bypass');
      if (bypass) {
        try {
          await bypass.listKeys();
        } catch (e) {
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle('🚨 [FALLO DE SESIÓN] Bypass APK (172.96.172.132)')
              .setDescription(`No se pudo verificar la sesión de Bypass APK:\n\`${e.message}\`\nEl bot intentará reautenticar automáticamente en la próxima solicitud.`)
              .setTimestamp()
          );
        }
      }

      // 2. Verificar nivel de Stock de KeyAuth
      const stock = db.getStock('keyauth');
      if (stock.length <= 3 && !notifiedKeyauthLow) {
        notifiedKeyauthLow = true;
        await logToAdminChannel(
          new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle('⚠️ [ALERTA DE STOCK] Stock Crítico de KeyAuth')
            .setDescription(
              stock.length === 0
                ? `🔴 **El stock de KeyAuth (Elite Pro) está completamente agotado.**\nUsa \`/stock add proveedor:keyauth claves:<...>\` para recargar.`
                : `🟡 Quedan únicamente **${stock.length} claves** de KeyAuth en stock.\nConsidera recargar pronto con \`/stock add\`.`
            )
            .setTimestamp()
        );
      } else if (stock.length > 3) {
        notifiedKeyauthLow = false;
      }

      // 3. Revisar vencimientos de revendedores
      const resellers = db.getAllResellers();
      const now = Date.now();
      for (const r of resellers) {
        const expTime = new Date(r.expiresAt).getTime();
        const diffMs = expTime - now;

        // Si expiró hace menos de 20 minutos (notificar una sola vez)
        if (now >= expTime && (now - expTime) < (20 * 60 * 1000)) {
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle('⌛ [MEMBRESÍA EXPIRADA] Revendedor Vencido')
              .setDescription(
                `La membresía del revendedor <@${r.userId}> ha vencido hoy.\n` +
                  `Ya no tiene acceso para generar claves hasta que se le renueve el tiempo con \`/revendedor asignar\`.`
              )
              .setTimestamp()
          );
        }
      }
    } catch (err) {
      console.error('[Monitor] Error en rutina de monitoreo:', err.message);
    }
  }, 15 * 60 * 1000); // Ejecutar cada 15 minutos
}

async function checkAndPostPanel(guild) {
  if (!config.discord.panelChannelId) return;
  try {
    const panelChannel = await guild.channels.fetch(config.discord.panelChannelId);
    if (panelChannel && panelChannel.isTextBased()) {
      const messages = await panelChannel.messages.fetch({ limit: 10 });
      const existing = messages.find(
        (m) => m.author.id === client.user.id && m.embeds.length > 0 && !m.embeds[0].title?.includes('ADMINISTRATIVO')
      );
      if (!existing) {
        await panelChannel.send(createPanelPayload());
        console.log('[Panel] Panel de licencias publicado en el canal exitosamente.');
      } else {
        await existing.edit(createPanelPayload());
        console.log('[Panel] Panel de licencias existente actualizado con el nuevo diseño.');
      }
    }
  } catch (err) {
    console.error('[Panel] Error al verificar/publicar panel:', err.message);
  }
}

async function checkAndPostAdminPanel(guild) {
  const channelId = config.discord.adminPanelChannelId || '1569766838533886032';
  if (!channelId) return;
  try {
    const adminChannel = await guild.channels.fetch(channelId);
    if (adminChannel && adminChannel.isTextBased()) {
      const messages = await adminChannel.messages.fetch({ limit: 10 });
      const existing = messages.find(
        (m) => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title?.includes('ADMINISTRATIVO')
      );
      if (!existing) {
        await adminChannel.send(createAdminPanelPayload());
        console.log(`[AdminPanel] Panel administrativo con botones publicado en ${channelId}.`);
      } else {
        await existing.edit(createAdminPanelPayload());
        console.log(`[AdminPanel] Panel administrativo existente actualizado en ${channelId}.`);
      }
    }
  } catch (err) {
    console.error(`[AdminPanel] Error al verificar/publicar panel administrativo en ${channelId}:`, err.message);
  }
}

function extractUserId(input) {
  if (!input) return null;
  const match = input.match(/\d{17,20}/);
  return match ? match[0] : null;
}

// Generador de plantilla "Listo para Reenviar" (WhatsApp / Telegram)
function getForwardTemplate({ providerName, keyOrUser, days, isAccount = false }) {
  if (isAccount) {
    const [uname, pass] = keyOrUser.includes(':') ? keyOrUser.split(':') : [keyOrUser, '1'];
    return (
      '```text\n' +
      `👤 Usuario: ${uname}\n` +
      `🔑 Contraseña: ${pass}\n` +
      `⏳ Duración: ${days} Días\n` +
      `📱 Plataforma: ${providerName}\n` +
      '⚠️ Nota: Válida para 1 solo dispositivo.\n' +
      '```'
    );
  }

  return (
    '```text\n' +
    `🔑 Clave: ${keyOrUser}\n` +
    `⏳ Duración: ${days} Días\n` +
    `📱 Plataforma: ${providerName}\n` +
    '⚠️ Nota: Válida para 1 solo dispositivo.\n' +
    '```'
  );
}

// Manejo de Interacciones
client.on('interactionCreate', async (interaction) => {
  try {
    // 1. COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      // /panel
      if (commandName === 'panel') {
        await interaction.channel.send(createPanelPayload());
        return interaction.reply({
          content: '✅ Panel interactivo publicado con éxito.',
          ephemeral: true,
        });
      }

      // /admin-panel
      if (commandName === 'admin-panel') {
        await interaction.channel.send(createAdminPanelPayload());
        return interaction.reply({
          content: '✅ Panel de control administrativo publicado con éxito.',
          ephemeral: true,
        });
      }

      // /admin (Gestión de Administradores del Bot)
      if (commandName === 'admin') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'agregar') {
          const target = interaction.options.getUser('usuario');
          const added = db.addBotAdmin(target.id);

          if (added) {
            const embed = new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle('👑 Nuevo Administrador del Bot')
              .setDescription(
                `Se ha nombrado a <@${target.id}> (${target.tag}) como **Administrador del Bot**.\nAhora tiene acceso total para gestionar revendedores, stock y paneles.`
              )
              .setTimestamp();

            await logToAdminChannel(
              new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('👑 Admin Añadido')
                .setDescription(`Dueño <@${interaction.user.id}> nombró admin a <@${target.id}>.`)
                .setTimestamp()
            );

            return interaction.reply({ embeds: [embed], ephemeral: true });
          } else {
            return interaction.reply({
              content: `ℹ️ El usuario <@${target.id}> ya era Administrador del Bot.`,
              ephemeral: true,
            });
          }
        }

        if (sub === 'quitar') {
          const target = interaction.options.getUser('usuario');
          const removed = db.removeBotAdmin(target.id);

          if (removed) {
            await logToAdminChannel(
              new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('👑 Admin Removido')
                .setDescription(`Dueño <@${interaction.user.id}> quitó el rango de admin a <@${target.id}>.`)
                .setTimestamp()
            );

            return interaction.reply({
              content: `🗑️ Se ha revocado el rango de Administrador del Bot a <@${target.id}>.`,
              ephemeral: true,
            });
          } else {
            return interaction.reply({
              content: `⚠️ El usuario <@${target.id}> no estaba en la lista de Administradores designados.`,
              ephemeral: true,
            });
          }
        }

        if (sub === 'lista') {
          const list = db.getBotAdmins();
          const serverOwnerId = interaction.guild?.ownerId;

          const lines = [
            `• 👑 **Dueño del Servidor:** <@${serverOwnerId}>`,
            ...list.map((id) => `• 🛡️ **Admin Designado:** <@${id}>`),
          ];

          const embed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle('👑 Administradores del Bot')
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'Sistema de Administradores' })
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

          const res = db.setReseller(target.id, dias, platforms, interaction.user.tag);
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
                `🌐 **Plataformas autorizadas:** \`${res.allowedProviders.join(', ')}\``
            )
            .setFooter({ text: 'Sistema de Revendedores • Auth Gateway' })
            .setTimestamp();

          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle('👤 Revendedor Asignado / Renovado')
              .setDescription(
                `Admin <@${interaction.user.id}> asignó **${dias} días** a <@${target.id}>.\nVence: \`${expDate}\``
              )
              .setTimestamp()
          );

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'quitar') {
          const target = interaction.options.getUser('usuario');
          const removed = db.removeReseller(target.id);

          if (removed) {
            await logToAdminChannel(
              new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('👤 [MEMBRESÍA REVOCADA] Revendedor Removido')
                .setDescription(`Admin <@${interaction.user.id}> revocó la membresía a <@${target.id}>.`)
                .setTimestamp()
            );
          }

          return interaction.reply({
            content: removed
              ? `🗑️ Se ha revocado la membresía de revendedor para <@${target.id}>.`
              : `⚠️ El usuario <@${target.id}> no estaba registrado como revendedor.`,
            ephemeral: true,
          });
        }

        if (sub === 'info') {
          const target = interaction.options.getUser('usuario');
          const res = db.getReseller(target.id);

          if (!res) {
            return interaction.reply({
              content: `ℹ️ El usuario <@${target.id}> no tiene membresía de revendedor asignada.`,
              ephemeral: true,
            });
          }

          const statusText = res.isExpired ? '🔴 Expirado' : `🟢 Activo (${res.daysLeft} días restantes)`;
          const expDate = new Date(res.expiresAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          });

          const embed = new EmbedBuilder()
            .setColor(res.isExpired ? 0xe74c3c : 0x00d2d3)
            .setTitle(`👤 Perfil de Revendedor: ${target.tag}`)
            .setDescription(
              `• **Estado:** ${statusText}\n` +
                `• **Vencimiento:** \`${expDate}\`\n` +
                `• **Plataformas autorizadas:** \`${res.allowedProviders.join(', ') || 'Ninguna'}\`\n` +
                `• **Asignado por:** ${res.addedBy}`
            )
            .setTimestamp();

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'lista') {
          const all = db.getAllResellers();
          if (all.length === 0) {
            return interaction.reply({
              content: 'ℹ️ No hay revendedores registrados actualmente.',
              ephemeral: true,
            });
          }

          const lines = all.map((r) => {
            const expDate = new Date(r.expiresAt).toLocaleDateString('es-ES');
            const state = r.isExpired ? '🔴 Expirado' : `🟢 ${r.daysLeft}d restantes`;
            return `• <@${r.userId}> ➔ ${state} (Vence: \`${expDate}\`) | [${r.allowedProviders.join(', ')}]`;
          });

          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('📋 Lista de Revendedores Registrados')
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'Sistema de Revendedores' });

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      // /stock
      if (commandName === 'stock') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
          const providerId = interaction.options.getString('proveedor');
          const rawKeys = interaction.options.getString('claves');
          const duracion = interaction.options.getInteger('duracion') || 30;
          const keysList = rawKeys.split(/[\s,\n]+/).map((k) => k.trim()).filter((k) => k.length > 0);

          const result = db.addStock(providerId, keysList, duracion);
          const pName = config.providers[providerId]?.name || providerId;

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

          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle('📦 Recarga de Stock (Auditoría)')
              .setDescription(`Admin <@${interaction.user.id}> cargó **${result.added} claves** (${duracion}d) para **${pName}**.\nTotal ahora: **${result.total}**.`)
              .setTimestamp()
          );

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'list') {
          const allStock = db.getAllStock();
          const lines = Object.entries(allStock).map(([pid, count]) => {
            const name = config.providers[pid]?.name || pid;
            const icon = count > 5 ? '🟢' : count > 0 ? '🟡' : '🔴';
            return `${icon} **${name}:** \`${count} claves en stock\``;
          });

          const embed = new EmbedBuilder()
            .setColor(0x00d2d3)
            .setTitle('📦 Inventario de Stock Precargado')
            .setDescription(lines.join('\n') + '\n\n💡 *Recarga stock con `/stock add proveedor:<...> claves:<...>`*')
            .setTimestamp();

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      // /mi-perfil
      if (commandName === 'mi-perfil') {
        const perms = db.getUserPermissions(interaction.member, config);
        const userKeys = db.getUserKeys(interaction.user.id, 100);

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
          membershipDesc = '⛔ **Estado:** Sin membresía de revendedor activa';
        }

        const embed = new EmbedBuilder()
          .setColor(perms.isExpired ? 0xe74c3c : 0x00d2d3)
          .setTitle('👤 Tu Perfil de Revendedor')
          .setDescription(
            `👤 **Usuario:** <@${interaction.user.id}>\n\n` +
              `${membershipDesc}\n\n` +
              `🌐 **Plataformas autorizadas:**\n\`${perms.allowedProviders.join(', ') || 'Ninguna'}\`\n\n` +
              `📊 **Total licencias emitidas por ti:** **${userKeys.length}**`
          )
          .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // /mis-keys
      if (commandName === 'mis-keys') {
        const userKeys = db.getUserKeys(interaction.user.id, 15);
        if (userKeys.length === 0) {
          return interaction.reply({
            content: 'ℹ️ Aún no has generado ninguna licencia.',
            ephemeral: true,
          });
        }

        const lines = userKeys.map(
          (k, idx) =>
            `${idx + 1}. \`${k.key}\` (${k.days}d) - **${config.providers[k.providerId]?.name || k.providerId}**`
        );

        const options = userKeys.slice(0, 15).map((k) => ({
          label: k.key.length > 25 ? `${k.key.substring(0, 22)}...` : k.key,
          value: `${k.providerId}|${k.key}`,
          description: `${k.days}d - ${config.providers[k.providerId]?.name || k.providerId}`,
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
    }

    // 2. BOTONES DEL PANEL
    if (interaction.isButton()) {
      const { customId, member, user } = interaction;
      const perms = db.getUserPermissions(member, config);

      // ── BOTONES EXCLUSIVOS DEL PANEL ADMINISTRATIVO ──
      if (customId.startsWith('admin_btn_')) {
        if (!perms.isAdmin) {
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle('🚨 [SEGURIDAD] Intento de Acceso a Panel Admin')
              .setDescription(`Usuario sin permisos <@${user.id}> (${user.tag}) intentó presionar un botón del Panel Administrativo.`)
              .setTimestamp()
          );
          return interaction.reply({
            content: '⛔ **Acceso denegado:** Solo los Administradores del Bot tienen permiso para interactuar con este panel.',
            ephemeral: true,
          });
        }

        if (customId === 'admin_btn_assign_reseller') {
          return interaction.showModal(getAdminAssignResellerModal());
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
          const allStock = db.getAllStock();
          const lines = Object.entries(allStock).map(([pid, count]) => {
            const name = config.providers[pid]?.name || pid;
            const icon = count > 5 ? '🟢' : count > 0 ? '🟡' : '🔴';
            return `${icon} **${name}:** \`${count} claves en stock\``;
          });

          const embed = new EmbedBuilder()
            .setColor(0x00d2d3)
            .setTitle('📦 Inventario de Stock Precargado')
            .setDescription(lines.join('\n') + '\n\n💡 *Puedes cargar más claves pulsando el botón verde **Cargar Stock**.*')
            .setFooter({ text: 'Panel Administrativo • Auth Gateway' })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        if (customId === 'admin_btn_list_resellers') {
          await interaction.deferReply({ ephemeral: true });
          const all = db.getAllResellers();
          if (all.length === 0) {
            return interaction.editReply({
              content: 'ℹ️ No hay revendedores registrados actualmente.',
            });
          }

          const lines = all.map((r) => {
            const expDate = new Date(r.expiresAt).toLocaleDateString('es-ES');
            const state = r.isExpired ? '🔴 Expirado' : `🟢 ${r.daysLeft}d restantes`;
            return `• <@${r.userId}> ➔ ${state} (Vence: \`${expDate}\`) | [${r.allowedProviders.join(', ')}]`;
          });

          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('📋 Lista de Revendedores Registrados')
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'Panel Administrativo • Auth Gateway' })
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }
      }

      // GENERAR KEY
      if (customId === 'btn_create_key') {
        if (!perms.isAdmin && (!perms.isReseller || perms.isExpired)) {
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xe67e22)
              .setTitle('🛡️ [SEGURIDAD] Intento no Autorizado')
              .setDescription(`Usuario <@${user.id}> (${user.tag}) intentó usar **Generar Key** sin membresía activa.`)
              .setTimestamp()
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

        // Si solo tiene acceso a 1 plataforma, abrir modal directo
        if (perms.allowedProviders.length === 1) {
          return interaction.showModal(
            getCreateKeyModal(perms.allowedProviders[0], perms.maxDays)
          );
        }

        // Filtrar plataformas autorizadas
        const options = perms.allowedProviders.map((pid) => {
          const p = providerManager.get(pid);
          return {
            label: p ? p.name : pid,
            value: pid,
            description: `Generar en ${p ? p.name : pid}`,
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
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xe67e22)
              .setTitle('🛡️ [SEGURIDAD] Intento no Autorizado')
              .setDescription(`Usuario <@${user.id}> (${user.tag}) intentó usar **Eliminar Key** sin membresía activa.`)
              .setTimestamp()
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
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xe67e22)
              .setTitle('🛡️ [SEGURIDAD] Intento no Autorizado')
              .setDescription(`Usuario <@${user.id}> (${user.tag}) intentó usar **Reset HWID** sin membresía activa.`)
              .setTimestamp()
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
        const userKeys = db.getUserKeys(user.id, 15);
        if (userKeys.length === 0) {
          return interaction.reply({
            content: 'ℹ️ Aún no has generado ninguna licencia.',
            ephemeral: true,
          });
        }

        const lines = userKeys.map(
          (k, idx) =>
            `${idx + 1}. \`${k.key}\` (${k.days}d) - **${config.providers[k.providerId]?.name || k.providerId}**`
        );

        const options = userKeys.slice(0, 15).map((k) => ({
          label: k.key.length > 25 ? `${k.key.substring(0, 22)}...` : k.key,
          value: `${k.providerId}|${k.key}`,
          description: `${k.days}d - ${config.providers[k.providerId]?.name || k.providerId}`,
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
      const perms = db.getUserPermissions(member, config);

      if (customId === 'select_create_provider') {
        const selectedProvider = values[0];
        if (!perms.allowedProviders.includes(selectedProvider) && !perms.isAdmin) {
          return interaction.reply({
            content: '⛔ No tienes acceso a esta plataforma.',
            ephemeral: true,
          });
        }
        return interaction.showModal(
          getCreateKeyModal(selectedProvider, perms.maxDays)
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
        if (!perms.isAdmin && (!perms.isReseller || perms.isExpired)) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** No tienes una membresía de revendedor activa.',
            ephemeral: true,
          });
        }

        const [providerId, key] = values[0].split('|');
        const provider = providerManager.get(providerId);

        if (!perms.isAdmin && !perms.allowedProviders.includes(providerId)) {
          return interaction.reply({
            content: '⛔ No tienes permiso para gestionar esta plataforma.',
            ephemeral: true,
          });
        }

        // Validar propiedad de la clave si no es admin
        const keyRecord = db.findKey(key);
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

          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xf39c12)
              .setTitle('🔄 HWID Reseteado por Revendedor')
              .setDescription(`Revendedor <@${user.id}> reseteó HWID de su clave: \`${key}\` (${provider.name}).`)
              .setTimestamp()
          );
        } catch (err) {
          await interaction.editReply({
            content: `❌ Error al resetear HWID: ${err.message}`,
          });
        }
      }
    }

    // 4. SUBMIT DE MODALS (Formularios)
    if (interaction.isModalSubmit()) {
      const { customId, member, user } = interaction;
      const perms = db.getUserPermissions(member, config);

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

        const platInput = (interaction.fields.getTextInputValue('input_admin_reseller_platforms') || 'all').trim();
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

        const res = db.setReseller(targetId, dias, platforms, user.tag);
        const expDate = new Date(res.expiresAt).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('✅ Revendedor Configurado Exitosamente')
          .setDescription(
            `• **Usuario:** <@${targetId}>\n` +
              `• **Tiempo asignado:** +${dias} días\n` +
              `• **Días totales restantes:** **${res.daysLeft} días** (Vence: \`${expDate}\`)\n` +
              `• **Plataformas autorizadas:** \`${res.allowedProviders.join(', ')}\``
          )
          .setFooter({ text: 'Panel Administrativo • Auth Gateway' })
          .setTimestamp();

        await logToAdminChannel(
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('👤 [PANEL ADMIN] Revendedor Asignado / Renovado')
            .setDescription(`Admin <@${user.id}> asignó **${dias} días** a <@${targetId}> desde el Panel Administrativo.\nVence: \`${expDate}\``)
            .setTimestamp()
        );

        return interaction.reply({ embeds: [embed], ephemeral: true });
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

        const removed = db.removeReseller(targetId);

        if (removed) {
          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle('👤 [PANEL ADMIN] Revendedor Removido')
              .setDescription(`Admin <@${user.id}> revocó la membresía a <@${targetId}> desde el Panel Administrativo.`)
              .setTimestamp()
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

        const res = db.getReseller(targetId);
        if (!res) {
          return interaction.reply({
            content: `ℹ️ El usuario <@${targetId}> no está registrado como revendedor en la base de datos.`,
            ephemeral: true,
          });
        }

        const statusText = res.isExpired ? '🔴 Expirado' : `🟢 Activo (${res.daysLeft} días restantes)`;
        const expDate = new Date(res.expiresAt).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });

        const userKeys = db.getUserKeys(targetId, 100);

        const embed = new EmbedBuilder()
          .setColor(res.isExpired ? 0xe74c3c : 0x00d2d3)
          .setTitle(`👤 Información de Revendedor: <@${targetId}>`)
          .setDescription(
            `• **Usuario:** <@${targetId}> (\`${targetId}\`)\n` +
              `• **Estado:** ${statusText}\n` +
              `• **Fecha de Vencimiento:** \`${expDate}\`\n` +
              `• **Plataformas Autorizadas:** \`${res.allowedProviders.join(', ') || 'Ninguna'}\`\n` +
              `• **Total Licencias Emitidas:** **${userKeys.length}**\n` +
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
        const dias = parseInt(interaction.fields.getTextInputValue('input_admin_stock_days') || '30', 10);
        const rawKeys = interaction.fields.getTextInputValue('input_admin_stock_keys');
        const keysList = rawKeys.split(/[\s,\n]+/).map((k) => k.trim()).filter((k) => k.length > 0);

        if (keysList.length === 0) {
          return interaction.reply({
            content: '❌ No se detectaron claves válidas en el texto ingresado.',
            ephemeral: true,
          });
        }

        const result = db.addStock(providerId, keysList, dias);
        const pName = config.providers[providerId]?.name || providerId;

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

        await logToAdminChannel(
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('📦 [PANEL ADMIN] Recarga de Stock')
            .setDescription(`Admin <@${user.id}> cargó **${result.added} claves** (${dias}d) para **${pName}** desde el Panel Admin.\nTotal ahora: **${result.total}**.`)
            .setTimestamp()
        );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // CREAR KEY
      if (customId.startsWith('modal_create_')) {
        const providerId = customId.replace('modal_create_', '');
        const provider = providerManager.get(providerId);

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

        let days = 30;
        let count = 1;
        let prefix = '';
        let note = '';

        if (providerId === 'keyauth') {
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
          days = 30;
        } else {
          days = parseInt(interaction.fields.getTextInputValue('input_days'), 10);
          count = parseInt(interaction.fields.getTextInputValue('input_count') || '1', 10);
          prefix = (interaction.fields.getTextInputValue('input_prefix') || '').trim();
          note = (interaction.fields.getTextInputValue('input_note') || '').trim();

          if (isNaN(days) || days <= 0 || days > perms.maxDays) {
            return interaction.reply({
              content: `❌ Duración inválida. Debe ser un número entre 1 y ${perms.maxDays} días.`,
              ephemeral: true,
            });
          }
        }

        if (isNaN(count) || count < 1 || count > 5) {
          return interaction.reply({
            content: '❌ La cantidad de keys debe ser entre 1 y 5.',
            ephemeral: true,
          });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const items = await provider.createKey({
            days,
            count,
            prefix: prefix || (providerId === 'mycheats' ? 'USER' : 'VIP'),
            note,
          });

          // Registrar en BD
          for (const item of items) {
            const keyValue = typeof item === 'object' ? item.key : item;
            const itemDays = typeof item === 'object' && item.days ? item.days : days;
            db.recordKey({
              userId: user.id,
              providerId,
              key: keyValue,
              days: itemDays,
              prefix,
              note,
            });
          }

          // Plantillas de Reenvío para WhatsApp
          const forwardTemplates = items
            .map((item) => {
              const val = typeof item === 'object' ? (item.username ? `${item.username}:1` : item.key) : item;
              const itemDays = typeof item === 'object' && item.days ? item.days : days;
              return getForwardTemplate({
                providerName: provider.name,
                keyOrUser: val,
                days: itemDays,
                isAccount: providerId === 'mycheats',
              });
            })
            .join('\n');

          const successEmbed = new EmbedBuilder()
            .setColor(0x00d2d3)
            .setTitle(`✅ ${providerId === 'mycheats' ? 'Cuenta Creada' : 'Licencia Creada'} (${provider.name})`)
            .setDescription(
              `Copia el siguiente recuadro para enviarlo directamente a tu cliente por WhatsApp:\n\n` +
                forwardTemplates +
                `\n💡 *Respuesta privada. También puedes ver tus claves en el botón **Mis Licencias**.*`
            )
            .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
            .setTimestamp();

          await interaction.editReply({ embeds: [successEmbed] });

          // Log de auditoría
          const logEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(providerId === 'mycheats' ? '👤 Usuario Creado por Revendedor' : '🔑 Licencia Creada por Revendedor')
            .addFields(
              { name: 'Revendedor', value: `<@${user.id}> (${user.tag})`, inline: true },
              { name: 'Plataforma', value: provider.name, inline: true },
              { name: 'Duración', value: `${days} días`, inline: true },
              {
                name: 'Claves / Cuentas',
                value: items
                  .map((k) => (typeof k === 'object' ? (k.username ? `||\`${k.username}:1\`||` : `||\`${k.key}\`||`) : `||\`${k}\`||`))
                  .join('\n'),
                inline: false,
              },
              { name: 'Nota', value: note || 'Sin nota', inline: false }
            )
            .setFooter({ text: 'Log Automático • Auth System' })
            .setTimestamp();

          await logToAdminChannel(logEmbed);
        } catch (err) {
          console.error('[Error Create Key]', err);
          await interaction.editReply({
            content: `❌ **Error al generar:**\n${err.message}`,
          });
        }
      }

      // ELIMINAR KEY
      if (customId.startsWith('modal_delete_')) {
        const providerId = customId.replace('modal_delete_', '');
        const provider = providerManager.get(providerId);
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
          const keyRecord = db.findKey(key);
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

          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle('🗑️ Licencia Eliminada')
              .addFields(
                { name: 'Usuario', value: `<@${user.id}>`, inline: true },
                { name: 'Plataforma', value: provider.name, inline: true },
                { name: 'Key', value: `\`${key}\``, inline: false }
              )
              .setTimestamp()
          );
        } catch (err) {
          await interaction.editReply({
            content: `❌ **Error al eliminar:** ${err.message}`,
          });
        }
      }

      // RESET HWID
      if (customId.startsWith('modal_reset_')) {
        const providerId = customId.replace('modal_reset_', '');
        const provider = providerManager.get(providerId);
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
          const keyRecord = db.findKey(key);
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

          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0xf39c12)
              .setTitle('🔄 HWID Reseteado')
              .addFields(
                { name: 'Usuario', value: `<@${user.id}>`, inline: true },
                { name: 'Plataforma', value: provider.name, inline: true },
                { name: 'Key', value: `\`${key}\``, inline: false }
              )
              .setTimestamp()
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
