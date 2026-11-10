const express = require('express');
const cookieParser = require('cookie-parser');
const { EmbedBuilder } = require('discord.js');

const config = require('../config');
const db = require('../database');
const providerManager = require('../providers');
const { createPanelPayload, createAdminPanelPayload } = require('../discord/panel');
const {
  getDiscordAuthUrl,
  exchangeDiscordCode,
  createMasterSession,
  destroySession,
  requireAuth,
  requireGuildAccess,
} = require('./auth');
const { renderLoginPage } = require('./views/login');
const { renderServersPage } = require('./views/servers');
const { renderDashboardPage } = require('./views/dashboard');

function getForwardTemplate({ providerName, keyOrUser, days, isAccount }) {
  if (isAccount) {
    return (
      '```text\n' +
      `👤 Usuario: ${keyOrUser}\n` +
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

// Enviar log administrativo al canal configurado de una guild
async function logToGuildAdminChannel(client, guildId, embed) {
  try {
    const gConfig = db.forGuild(guildId).getConfig();
    const channelId = gConfig?.channels?.logsChannelId || (guildId === config.discord.guildId ? config.discord.logsChannelId : null);
    if (!channelId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error(`[Web Logs] Error al enviar log a guild ${guildId}:`, err.message);
  }
}

function createWebServer(client) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ── RUTAS DE AUTENTICACIÓN ──

  app.get('/', (req, res) => {
    const token = req.cookies?.session_token;
    if (token) {
      return res.redirect('/servers');
    }
    res.redirect('/login');
  });

  app.get('/login', (req, res) => {
    res.send(renderLoginPage());
  });

  // Login directo con contraseña maestra
  app.post('/login/admin', (req, res) => {
    const { password } = req.body;
    if (password && password === config.web.adminPassword) {
      const { sessionToken } = createMasterSession();
      res.cookie('session_token', sessionToken, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });
      return res.redirect('/servers');
    }
    res.send(renderLoginPage('Contraseña maestra incorrecta. Inténtalo de nuevo.'));
  });

  // Iniciar flujo Discord OAuth2
  app.get('/auth/discord', (req, res) => {
    if (!config.web.clientSecret) {
      return res.send(renderLoginPage('Falta configurar DISCORD_CLIENT_SECRET en .env para inicio con Discord. Puedes ingresar con la Contraseña Maestra abajo.'));
    }
    const redirectUrl = getDiscordAuthUrl();
    res.redirect(redirectUrl);
  });

  // Callback de Discord OAuth2
  app.get('/auth/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error || !code) {
      return res.redirect('/login');
    }

    try {
      const { sessionToken } = await exchangeDiscordCode(code);
      res.cookie('session_token', sessionToken, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });
      res.redirect('/servers');
    } catch (err) {
      console.error('[OAuth2] Error en callback de Discord:', err.response?.data || err.message);
      res.send(renderLoginPage('Error al autenticar con Discord: ' + (err.response?.data?.error_description || err.message)));
    }
  });

  app.get('/logout', (req, res) => {
    const token = req.cookies?.session_token;
    destroySession(token);
    res.clearCookie('session_token');
    res.redirect('/login');
  });

  // ── SELECCIÓN DE SERVIDORES (MULTI-TENANT) ──

  app.get('/servers', requireAuth, (req, res) => {
    const session = req.session;
    const botGuilds = client.guilds.cache;

    let serversList = [];

    if (session.type === 'master') {
      // El administrador maestro ve todos los servidores donde está el bot
      serversList = botGuilds.map((g) => {
        const gDb = db.forGuild(g.id);
        const data = gDb.getData();
        return {
          id: g.id,
          name: g.name,
          iconUrl: g.iconURL ? g.iconURL() : null,
          botPresent: true,
          resellersCount: Object.keys(data.resellers || {}).length,
          keysCount: (data.generatedKeys || []).length,
        };
      });

      // Incluir también cualquier servidor guardado en base de datos aunque el bot esté reconectando
      const knownGuilds = db.getGuildList();
      for (const kg of knownGuilds) {
        if (!serversList.some((s) => s.id === kg.id)) {
          serversList.push({
            id: kg.id,
            name: kg.name,
            iconUrl: null,
            botPresent: false,
            resellersCount: kg.resellersCount,
            keysCount: kg.keysCount,
          });
        }
      }
    } else {
      // Usuario autenticado por Discord: lista los servidores donde es admin
      const userAdminGuilds = session.adminGuilds || [];
      serversList = userAdminGuilds.map((ag) => {
        const botInGuild = botGuilds.has(ag.id);
        const gDb = db.forGuild(ag.id);
        const data = gDb.getData();
        return {
          id: ag.id,
          name: ag.name,
          iconUrl: ag.iconUrl,
          botPresent: botInGuild,
          resellersCount: Object.keys(data.resellers || {}).length,
          keysCount: (data.generatedKeys || []).length,
        };
      });
    }

    res.send(renderServersPage(session.user, serversList));
  });

  // ── VISTA DEL DASHBOARD POR SERVIDOR ──

  app.get('/dashboard/:guildId', requireAuth, requireGuildAccess(client, db), (req, res) => {
    const { guildId } = req.params;
    const guild = req.guild || {
      id: guildId,
      name: `Servidor (${guildId})`,
      iconURL: () => null,
    };
    const guildData = req.guildDb.getData();
    res.send(renderDashboardPage(req.session.user, guild, guildData, config.providers));
  });

  // ── API ENDPOINTS (MULTI-TENANT POR GUILD) ──

  // 1. Estadísticas de Resumen
  app.get('/api/guilds/:guildId/stats', requireAuth, requireGuildAccess(client, db), (req, res) => {
    const gDb = req.guildDb;
    const gData = gDb.getData();
    res.json({
      resellersCount: Object.keys(gData.resellers || {}).length,
      keysCount: (gData.generatedKeys || []).length,
      stock: gDb.getAllStock(),
      botPresent: Boolean(req.guild),
    });
  });

  // 2. Lista de Revendedores
  app.get('/api/guilds/:guildId/resellers', requireAuth, requireGuildAccess(client, db), (req, res) => {
    const list = req.guildDb.getAllResellers();
    res.json(list);
  });

  // 3. Crear / Asignar Revendedor
  app.post('/api/guilds/:guildId/resellers', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const { userId, days, platforms } = req.body;
    if (!userId || !days) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (userId, days).' });
    }

    const cleanUser = String(userId).replace(/[^0-9]/g, '');
    const numDays = parseInt(days, 10);
    if (isNaN(numDays) || numDays <= 0) {
      return res.status(400).json({ error: 'Días inválidos.' });
    }

    const addedBy = req.user.username || 'Panel Web';
    const result = req.guildDb.setReseller(cleanUser, numDays, platforms, addedBy);

    // Auditoría
    const opTag = req.user.username || 'Web Admin';
    await logToGuildAdminChannel(
      client,
      req.params.guildId,
      new EmbedBuilder()
        .setColor(0x16a34a)
        .setTitle('[ADMINISTRACIÓN] Asignación de Revendedor')
        .addFields(
          { name: 'Operador', value: `${opTag} (Panel Web)`, inline: true },
          { name: 'Rango Operador', value: 'Administrador Web', inline: true },
          { name: 'Revendedor Asignado', value: `<@${cleanUser}>`, inline: true },
          { name: 'Tiempo Otorgado', value: `+${numDays} días`, inline: true },
          { name: 'Días Restantes', value: `${result.daysLeft} días`, inline: true },
          { name: 'Plataformas', value: result.allowedProviders.join(', '), inline: false }
        )
        .setFooter({ text: 'Sistema de Auditoría • Auth Gateway Web' })
        .setTimestamp()
    );

    res.json({ success: true, reseller: result });
  });

  // 4. Quitar Revendedor
  app.delete('/api/guilds/:guildId/resellers/:userId', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const { userId } = req.params;
    const removed = req.guildDb.removeReseller(userId);

    if (removed) {
      const opTag = req.user.username || 'Web Admin';
      await logToGuildAdminChannel(
        client,
        req.params.guildId,
        new EmbedBuilder()
          .setColor(0xdc2626)
          .setTitle('[ADMINISTRACIÓN] Revocación de Revendedor')
          .addFields(
            { name: 'Operador', value: `${opTag} (Panel Web)`, inline: true },
            { name: 'Revendedor Revocado', value: `<@${userId}>`, inline: true },
            { name: 'Origen', value: 'Dashboard Web Multi-Servidor', inline: false }
          )
          .setFooter({ text: 'Sistema de Auditoría • Auth Gateway Web' })
          .setTimestamp()
      );
    }

    res.json({ success: true, removed });
  });

  // 5. Inventario de Stock
  app.get('/api/guilds/:guildId/stock', requireAuth, requireGuildAccess(client, db), (req, res) => {
    const stock = req.guildDb.getAllStock();
    res.json(stock);
  });

  // 6. Cargar Lote de Claves al Stock
  app.post('/api/guilds/:guildId/stock', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const { providerId, days, rawKeys } = req.body;
    if (!providerId || !rawKeys) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    const keysList = String(rawKeys)
      .split(/[\s,\n]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keysList.length === 0) {
      return res.status(400).json({ error: 'No se encontraron claves válidas.' });
    }

    const numDays = parseInt(days || '30', 10);
    const result = req.guildDb.addStock(providerId, keysList, numDays);

    const opTag = req.user.username || 'Web Admin';
    await logToGuildAdminChannel(
      client,
      req.params.guildId,
      new EmbedBuilder()
        .setColor(0x16a34a)
        .setTitle('[STOCK] Recarga de Inventario')
        .addFields(
          { name: 'Operador', value: `${opTag} (Panel Web)`, inline: true },
          { name: 'Plataforma', value: providerId, inline: true },
          { name: 'Claves Añadidas', value: `+${result.added} claves`, inline: true },
          { name: 'Stock Total', value: `${result.total} claves`, inline: true }
        )
        .setFooter({ text: 'Sistema de Auditoría • Auth Gateway Web' })
        .setTimestamp()
    );

    res.json({ success: true, added: result.added, total: result.total });
  });

  // 7. Historial de Claves
  app.get('/api/guilds/:guildId/keys', requireAuth, requireGuildAccess(client, db), (req, res) => {
    const keys = req.guildDb.getAllKeys(300);
    res.json(keys);
  });

  // 8. Emisión Rápida de Licencias desde Web
  app.post('/api/guilds/:guildId/keys/create', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const { providerId, days = 30, count = 1, prefix = '', note = '' } = req.body;
    const { guildId } = req.params;

    const provider = providerManager.getForGuild(providerId, guildId, db);
    if (!provider) {
      return res.status(404).json({ error: 'Proveedor no disponible.' });
    }

    try {
      const items = await provider.createKey({
        days: Number(days),
        count: Number(count),
        prefix,
        note,
      });

      // Registrar en la BD de este servidor
      for (const item of items) {
        const keyValue = typeof item === 'object' ? item.key : item;
        const itemDays = typeof item === 'object' && item.days ? item.days : days;
        req.guildDb.recordKey({
          userId: req.user.id,
          providerId,
          key: keyValue,
          days: itemDays,
          prefix,
          note,
        });
      }

      // Generar plantilla de WhatsApp
      const forwardText = items
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

      // Auditoría en Discord
      const isAccount = providerId === 'mycheats';
      await logToGuildAdminChannel(
        client,
        guildId,
        new EmbedBuilder()
          .setColor(0x2563eb)
          .setTitle(isAccount ? '[AUDITORÍA] Creación de Cuenta VIP' : '[AUDITORÍA] Emisión de Licencia')
          .addFields(
            { name: 'Operador', value: `${req.user.username} (Panel Web)`, inline: true },
            { name: 'Rango', value: 'Administrador Web', inline: true },
            { name: 'Membresía', value: 'Acceso Ilimitado Permanente', inline: true },
            { name: 'Plataforma', value: provider.name, inline: true },
            { name: 'Duración', value: `${days} días`, inline: true },
            { name: 'Cantidad', value: `${count} unidad(es)`, inline: true },
            {
              name: isAccount ? 'Cuentas Generadas' : 'Claves Generadas',
              value: items
                .map((k) => (typeof k === 'object' ? (k.username ? `||\`${k.username}:1\`||` : `||\`${k.key}\`||`) : `||\`${k}\`||`))
                .join('\n'),
              inline: false,
            },
            { name: 'Nota / Cliente', value: note || 'Sin nota', inline: false }
          )
          .setFooter({ text: 'Sistema de Auditoría • Auth Gateway Web' })
          .setTimestamp()
      );

      res.json({ success: true, items, forwardText });
    } catch (err) {
      console.error('[Web Key Gen Error]', err);
      res.status(500).json({ error: err.message || 'Error al generar licencia.' });
    }
  });

  // 9. Reset de HWID directo
  app.post('/api/guilds/:guildId/keys/reset-hwid', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const { providerId, key } = req.body;
    const { guildId } = req.params;

    const provider = providerManager.getForGuild(providerId, guildId, db);
    if (!provider) {
      return res.status(404).json({ error: 'Proveedor no encontrado.' });
    }

    try {
      const result = await provider.resetHwid(key);

      await logToGuildAdminChannel(
        client,
        guildId,
        new EmbedBuilder()
          .setColor(0xd97706)
          .setTitle('[AUDITORÍA] Restablecimiento de HWID')
          .addFields(
            { name: 'Operador', value: `${req.user.username} (Panel Web)`, inline: true },
            { name: 'Rango', value: 'Administrador Web', inline: true },
            { name: 'Membresía', value: 'Acceso Ilimitado Permanente', inline: true },
            { name: 'Plataforma', value: provider.name, inline: true },
            { name: 'Clave / Licencia', value: `\`${key}\``, inline: false },
            { name: 'Resultado', value: `${result}`, inline: false }
          )
          .setFooter({ text: 'Sistema de Auditoría • Auth Gateway Web' })
          .setTimestamp()
      );

      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Eliminar Licencia directo
  app.post('/api/guilds/:guildId/keys/delete', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const { providerId, key, keyId } = req.body;
    const { guildId } = req.params;

    const provider = providerManager.getForGuild(providerId, guildId, db);
    if (provider && provider.deleteKey) {
      try {
        await provider.deleteKey(key);
      } catch (e) {
        console.warn(`[Delete Key API] Aviso del proveedor: ${e.message}`);
      }
    }

    req.guildDb.deleteKeyRecord(keyId || key);

    await logToGuildAdminChannel(
      client,
      guildId,
      new EmbedBuilder()
        .setColor(0xdc2626)
        .setTitle('[AUDITORÍA] Revocación de Licencia')
        .addFields(
          { name: 'Operador', value: `${req.user.username} (Panel Web)`, inline: true },
          { name: 'Plataforma', value: provider?.name || providerId, inline: true },
          { name: 'Clave Eliminada', value: `\`${key}\``, inline: false }
        )
        .setFooter({ text: 'Sistema de Auditoría • Auth Gateway Web' })
        .setTimestamp()
    );

    res.json({ success: true });
  });

  // 11. Obtener Configuración de Servidor
  app.get('/api/guilds/:guildId/config', requireAuth, requireGuildAccess(client, db), (req, res) => {
    const cfg = req.guildDb.getConfig();
    res.json(cfg);
  });

  // 12. Guardar Configuración de Servidor
  app.post('/api/guilds/:guildId/config', requireAuth, requireGuildAccess(client, db), (req, res) => {
    const { channels, providersConfig } = req.body;
    const updated = req.guildDb.updateConfig({ channels, providersConfig });
    providerManager.invalidateGuild(req.params.guildId);
    res.json({ success: true, config: updated });
  });

  // 13. Publicar Panel de Licencias en Discord
  app.post('/api/guilds/:guildId/publish-panel', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const { guildId } = req.params;
    const cfg = req.guildDb.getConfig();
    const channelId = cfg.channels?.panelChannelId || (guildId === config.discord.guildId ? config.discord.panelChannelId : null);

    if (!channelId) {
      return res.status(400).json({ error: 'No hay un Canal de Panel de Licencias configurado en la pestaña Configuración.' });
    }

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return res.status(404).json({ error: 'Canal de Discord no encontrado o no es de texto.' });
      }
      await channel.send(createPanelPayload());
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: `Error al publicar en Discord: ${err.message}` });
    }
  });

  // 14. Publicar Panel Administrativo en Discord
  app.post('/api/guilds/:guildId/publish-admin-panel', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const { guildId } = req.params;
    const cfg = req.guildDb.getConfig();
    const channelId = cfg.channels?.adminPanelChannelId || (guildId === config.discord.guildId ? config.discord.adminPanelChannelId : null);

    if (!channelId) {
      return res.status(400).json({ error: 'No hay un Canal de Panel Administrativo configurado en la pestaña Configuración.' });
    }

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return res.status(404).json({ error: 'Canal de Discord no encontrado o no es de texto.' });
      }
      await channel.send(createAdminPanelPayload());
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: `Error al publicar en Discord: ${err.message}` });
    }
  });

  return app;
}

function startWebServer(client) {
  const app = createWebServer(client);
  const port = config.web.port;

  app.listen(port, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🌐 [Dashboard Web] Servidor en línea en puerto: ${port}`);
    console.log(`🔗 Acceso: http://localhost:${port}`);
    console.log(`🔑 Contraseña Maestra: ${config.web.adminPassword}`);
    console.log(`======================================================\n`);
  });

  return app;
}

module.exports = { createWebServer, startWebServer };
