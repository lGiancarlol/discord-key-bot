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
const { createPanelPayload } = require('./discord/panel');
const {
  getCreateKeyModal,
  getDeleteKeyModal,
  getResetHwidModal,
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
  connectToVoiceChannel(guild);
});

// Cuando el bot sea invitado al servidor
client.on('guildCreate', async (guild) => {
  if (guild.id === config.discord.guildId) {
    console.log(`[Servidor Unido] El bot fue añadido a: ${guild.name}`);
    await registerSlashCommands();
    await checkAndPostPanel(guild);
    connectToVoiceChannel(guild);
  }
});

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

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`[Voz] 🟢 Conectado exitosamente al canal de voz: ${channel.name} (${channel.id})`);
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.warn('[Voz] Conexión de voz desconectada. Reintentando en 5s...');
      setTimeout(() => connectToVoiceChannel(guild), 5000);
    });
  } catch (err) {
    console.error('[Voz] Error al conectar al canal de voz:', err.message);
  }
}

async function checkAndPostPanel(guild) {
  if (!config.discord.panelChannelId) return;
  try {
    const panelChannel = await guild.channels.fetch(config.discord.panelChannelId);
    if (panelChannel && panelChannel.isTextBased()) {
      const messages = await panelChannel.messages.fetch({ limit: 10 });
      const existing = messages.find(
        (m) => m.author.id === client.user.id && m.embeds.length > 0
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

// Generador de plantilla "Listo para Reenviar" (WhatsApp / Telegram)
function getForwardTemplate({ providerName, keyOrUser, days, isAccount = false }) {
  if (isAccount) {
    const [uname, pass] = keyOrUser.includes(':') ? keyOrUser.split(':') : [keyOrUser, '1'];
    return (
      '```text\n' +
      '╔══════════════════════════════════╗\n' +
      '   💎 TU CUENTA OFICIAL VIP\n' +
      '╚══════════════════════════════════╝\n' +
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
    '╔══════════════════════════════════╗\n' +
    '   💎 TU LICENCIA OFICIAL VIP\n' +
    '╚══════════════════════════════════╝\n' +
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
          const keysList = rawKeys.split(/[\s,\n]+/).map((k) => k.trim()).filter((k) => k.length > 0);

          const result = db.addStock(providerId, keysList);
          const pName = config.providers[providerId]?.name || providerId;

          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('📦 Stock de Claves Actualizado')
            .setDescription(
              `• **Plataforma:** \`${pName}\`\n` +
                `• **Claves añadidas:** **+${result.added}**\n` +
                `• **Stock total disponible:** **${result.total} claves**`
            )
            .setTimestamp();

          await logToAdminChannel(
            new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle('📦 Recarga de Stock (Auditoría)')
              .setDescription(`Admin <@${interaction.user.id}> cargó **${result.added} claves** para **${pName}**.\nTotal ahora: **${result.total}**.`)
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

      // GENERAR KEY
      if (customId === 'btn_create_key') {
        if (!perms.isAdmin && perms.isExpired) {
          return interaction.reply({
            content: '⛔ **Acceso denegado:** Tu membresía de revendedor ha expirado o no tienes acceso activo.\nContacta al administrador para renovar tu tiempo.',
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
        if (!perms.isAdmin && perms.isExpired) {
          return interaction.reply({
            content: '⛔ Tu membresía de revendedor ha expirado.',
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
        if (!perms.isAdmin && perms.isExpired) {
          return interaction.reply({
            content: '⛔ Tu membresía de revendedor ha expirado.',
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
        return interaction.showModal(getDeleteKeyModal(values[0]));
      }

      if (customId === 'select_reset_provider') {
        return interaction.showModal(getResetHwidModal(values[0]));
      }

      // Reset rápido de HWID desde el panel personal
      if (customId === 'select_quick_hwid_reset') {
        const [providerId, key] = values[0].split('|');
        const provider = providerManager.get(providerId);

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

      // CREAR KEY
      if (customId.startsWith('modal_create_')) {
        const providerId = customId.replace('modal_create_', '');
        const provider = providerManager.get(providerId);

        if (!perms.isAdmin && perms.isExpired) {
          return interaction.reply({
            content: '⛔ Tu membresía de revendedor ha expirado.',
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

        const days = parseInt(interaction.fields.getTextInputValue('input_days'), 10);
        const count = parseInt(interaction.fields.getTextInputValue('input_count') || '1', 10);
        const prefix = (interaction.fields.getTextInputValue('input_prefix') || '').trim();
        const note = (interaction.fields.getTextInputValue('input_note') || '').trim();

        if (isNaN(days) || days <= 0 || days > perms.maxDays) {
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
            db.recordKey({
              userId: user.id,
              providerId,
              key: keyValue,
              days,
              prefix,
              note,
            });
          }

          // Plantillas de Reenvío para WhatsApp
          const forwardTemplates = items
            .map((item) => {
              const val = typeof item === 'object' ? (item.username ? `${item.username}:1` : item.key) : item;
              return getForwardTemplate({
                providerName: provider.name,
                keyOrUser: val,
                days,
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
