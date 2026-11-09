const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
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
client.once('ready', async () => {
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

// Manejo de Interacciones
client.on('interactionCreate', async (interaction) => {
  try {
    // 1. COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'panel') {
        await interaction.channel.send(createPanelPayload());
        return interaction.reply({
          content: '✅ Panel de control publicado con éxito.',
          ephemeral: true,
        });
      }

      if (commandName === 'permisos') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'asignar') {
          const target = interaction.options.getMentionable('destino');
          const plataformasInput = interaction.options.getString('plataformas');
          const maxDias = interaction.options.getInteger('max_dias') || 30;

          let targetPlatforms = [];
          if (plataformasInput.toLowerCase() === 'all') {
            targetPlatforms = Object.keys(config.providers);
          } else {
            targetPlatforms = plataformasInput
              .split(',')
              .map((p) => p.trim().toLowerCase())
              .filter((p) => config.providers[p]);
          }

          if (targetPlatforms.length === 0) {
            return interaction.reply({
              content:
                '❌ Plataforma inválida. Opciones disponibles: `bypass`, `mycheats`, `keyauth` o `all`.',
              ephemeral: true,
            });
          }

          db.setPermission(target.id, targetPlatforms, maxDias);

          return interaction.reply({
            content: `✅ Permisos asignados a **${target.user ? target.user.tag : target.name}**:\n• Plataformas: \`${targetPlatforms.join(', ')}\`\n• Máximo días: **${maxDias}**`,
            ephemeral: true,
          });
        }

        if (sub === 'revocar') {
          const target = interaction.options.getMentionable('destino');
          db.removePermission(target.id);
          return interaction.reply({
            content: `🗑️ Permisos revocados para **${target.user ? target.user.tag : target.name}**.`,
            ephemeral: true,
          });
        }

        if (sub === 'listar') {
          const all = db.getAllPermissions();
          const entries = Object.entries(all);

          if (entries.length === 0) {
            return interaction.reply({
              content: 'ℹ️ No hay permisos personalizados asignados aún (los administradores del servidor tienen acceso total por defecto).',
              ephemeral: true,
            });
          }

          const desc = entries
            .map(
              ([id, data]) =>
                `• <@${id}> (o Rol <@&${id}>) ➔ [${data.providers.join(', ')}] (Máx: ${data.maxDays}d)`
            )
            .join('\n');

          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('🔐 Permisos de Plataformas Asignados')
            .setDescription(desc)
            .setFooter({ text: 'Sistema de Licencias' });

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

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

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('📊 Estado de Servicios y Plataformas')
          .addFields(
            { name: 'Bypass Web (Licencias)', value: bypassInfo, inline: false },
            { name: 'Bypass UID (Auto ON)', value: '🟢 Sistema Online (172.96.172.132:3000)', inline: false },
            { name: 'WorldCheats (Usuarios)', value: '🟢 Sistema Online (App 146)', inline: false },
            { name: 'KeyAuth (keyauth.cc)', value: config.providers.keyauth.sellerKey ? '🟢 Configurado' : '⚠️ Pendiente Seller Key', inline: false },
            { name: 'Total Creadas por Bot', value: `${db.data.generatedKeys.length}`, inline: true }
          )
          .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' });

        return interaction.editReply({ embeds: [embed] });
      }
    }

    // 2. BOTONES DEL PANEL
    if (interaction.isButton()) {
      const { customId, member } = interaction;
      const perms = db.getUserPermissions(member, config);

      if (customId === 'btn_create_key') {
        if (!perms.isAdmin && perms.allowedProviders.length === 0) {
          return interaction.reply({
            content: '⛔ **Acceso Denegado:** No tienes permisos para crear licencias. Solicita acceso a un administrador.',
            ephemeral: true,
          });
        }

        // Si solo tiene acceso a 1 proveedor, abrir directamente el modal
        if (perms.allowedProviders.length === 1) {
          const providerId = perms.allowedProviders[0];
          return interaction.showModal(
            getCreateKeyModal(providerId, perms.maxDays)
          );
        }

        // Si tiene múltiples proveedores, mostrar selector
        const options = perms.allowedProviders.map((pid) => {
          const p = providerManager.get(pid);
          return {
            label: p ? p.name : pid,
            value: pid,
            description: `Generar licencia en ${p ? p.name : pid}`,
          };
        });

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_create_provider')
            .setPlaceholder('Selecciona la plataforma para tu key')
            .addOptions(options)
        );

        return interaction.reply({
          content: '🔍 **Selecciona la plataforma web donde deseas crear la licencia:**',
          components: [selectRow],
          ephemeral: true,
        });
      }

      if (customId === 'btn_delete_key') {
        if (!perms.isAdmin && perms.allowedProviders.length === 0) {
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
            .setPlaceholder('Selecciona la plataforma de la key a eliminar')
            .addOptions(options)
        );

        return interaction.reply({
          content: 'Selecciona la plataforma de la clave que deseas eliminar:',
          components: [selectRow],
          ephemeral: true,
        });
      }

      if (customId === 'btn_reset_hwid') {
        if (!perms.isAdmin && perms.allowedProviders.length === 0) {
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

      if (customId === 'btn_my_keys') {
        const userKeys = db.getUserKeys(interaction.user.id, 15);
        if (userKeys.length === 0) {
          return interaction.reply({
            content: 'ℹ️ Aún no has generado ninguna licencia en esta sesión.',
            ephemeral: true,
          });
        }

        const lines = userKeys.map(
          (k) => `• \`${k.key}\` (${k.days}d) - [${k.providerId}] active`
        );

        const embed = new EmbedBuilder()
          .setColor(0x00a8ff)
          .setTitle('ℹ️ Tus Licencias Generadas')
          .setDescription(lines.join('\n'))
          .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (customId === 'btn_my_membership') {
        const embed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle('📄 Estado de tu Membresía / Acceso')
          .setDescription(
            `👤 **Usuario:** <@${interaction.user.id}>\n` +
              `⭐ **Rango:** ${perms.isAdmin ? '👑 Administrador / Dueño' : 'Revendedor Autorizado'}\n` +
              `🌐 **Plataformas autorizadas:** \`${perms.allowedProviders.join(', ') || 'Ninguna'}\`\n` +
              `⌛ **Duración máxima permitida:** **${perms.maxDays} días**`
          )
          .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    // 3. SELECT MENUS (Cuando se elige plataforma)
    if (interaction.isStringSelectMenu()) {
      const { customId, values, member } = interaction;
      const perms = db.getUserPermissions(member, config);
      const selectedProvider = values[0];

      if (customId === 'select_create_provider') {
        return interaction.showModal(
          getCreateKeyModal(selectedProvider, perms.maxDays)
        );
      }
      if (customId === 'select_delete_provider') {
        return interaction.showModal(getDeleteKeyModal(selectedProvider));
      }
      if (customId === 'select_reset_provider') {
        return interaction.showModal(getResetHwidModal(selectedProvider));
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

          let successEmbed;

          if (providerId === 'mycheats') {
            // Formato Usuario y Contraseña para WorldCheats
            const userBlocks = items
              .map((u) => {
                const uname = typeof u === 'object' ? u.username : u.split(':')[0];
                return `👤 **Usuario:** \`${uname}\`\n🔑 **Contraseña:** \`1\``;
              })
              .join('\n\n');

            successEmbed = new EmbedBuilder()
              .setColor(0x00d2d3)
              .setTitle('✅ Cuenta Creada Exitosamente (WorldCheats)')
              .setDescription(
                `Aquí tienes los datos de acceso para WorldCheats:\n\n${userBlocks}\n\n` +
                  `⌛ **Duración:** ${days} Días\n` +
                  `🌐 **Plataforma:** \`${provider.name}\`\n\n` +
                  `⚠️ *Esta respuesta es privada (efímera). Guárdala en un lugar seguro.*`
              )
              .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
              .setTimestamp();
          } else if (providerId === 'bypass_uid') {
            // Formato Bypass UID
            const keyBlock = items
              .map((k) => `\`\`\`\n${typeof k === 'object' ? k.key : k}\n\`\`\``)
              .join('');

            successEmbed = new EmbedBuilder()
              .setColor(0x9b59b6)
              .setTitle('✅ Licencia Bypass UID Creada')
              .setDescription(
                `Aquí tienes tu nueva licencia Bypass UID generada:\n\n${keyBlock}\n` +
                  `🟢 **Estado UID:** \`UID ON Automático\`\n` +
                  `⌛ **Duración:** ${days} Días\n` +
                  `🏷️ **Prefijo:** \`${prefix || 'Default'}\`\n` +
                  `🌐 **Plataforma:** \`${provider.name}\`\n\n` +
                  `⚠️ *Esta respuesta es privada (efímera). Guárdala en un lugar seguro.*`
              )
              .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
              .setTimestamp();
          } else {
            // Formato Licencias tradicionales (Bypass Web / KeyAuth)
            const keyBlock = items
              .map((k) => `\`\`\`\n${typeof k === 'object' ? k.key : k}\n\`\`\``)
              .join('');

            successEmbed = new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle('✅ Licencia Creada Exitosamente')
              .setDescription(
                `Aquí tienes tu nueva licencia generada:\n\n${keyBlock}\n` +
                  `⌛ **Duración:** ${days} Días\n` +
                  `🏷️ **Prefijo:** \`${prefix || 'Default'}\`\n` +
                  `🌐 **Plataforma:** \`${provider.name}\`\n\n` +
                  `⚠️ *Esta respuesta es privada (efímera). Guárdala en un lugar seguro.*`
              )
              .setFooter({ text: 'Desarrollado por Gian • Auth Cloud Gateway' })
              .setTimestamp();
          }

          await interaction.editReply({ embeds: [successEmbed] });

          // Embed para canal de auditoría / logs
          const logEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(
              providerId === 'mycheats'
                ? '👤 Usuario Creado (Auditoría)'
                : '🔑 Licencia Generada (Auditoría)'
            )
            .addFields(
              { name: 'Generado por', value: `<@${user.id}> (${user.tag})`, inline: true },
              { name: 'Plataforma', value: provider.name, inline: true },
              { name: 'Duración', value: `${days} días`, inline: true },
              {
                name: providerId === 'mycheats' ? 'Cuentas' : 'Claves generadas',
                value: items
                  .map((k) => {
                    if (typeof k === 'object') {
                      return k.username ? `||\`${k.username}:1\`||` : `||\`${k.key}\`||`;
                    }
                    return `||\`${k}\`||`;
                  })
                  .join('\n'),
                inline: false,
              },
              { name: 'Nota / Observación', value: note || 'Sin nota', inline: false }
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

          // Log
          const logEmbed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🗑️ Licencia Eliminada')
            .addFields(
              { name: 'Usuario', value: `<@${user.id}>`, inline: true },
              { name: 'Plataforma', value: provider.name, inline: true },
              { name: 'Key', value: `\`${key}\``, inline: false }
            )
            .setTimestamp();
          await logToAdminChannel(logEmbed);
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

          // Log
          const logEmbed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle('🔄 HWID Reseteado')
            .addFields(
              { name: 'Usuario', value: `<@${user.id}>`, inline: true },
              { name: 'Plataforma', value: provider.name, inline: true },
              { name: 'Key', value: `\`${key}\``, inline: false }
            )
            .setTimestamp();
          await logToAdminChannel(logEmbed);
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
