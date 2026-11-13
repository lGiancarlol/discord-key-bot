const express = require('express');
const cookieParser = require('cookie-parser');
const { EmbedBuilder } = require('discord.js');

const config = require('../config');
const db = require('../database');
const providerManager = require('../providers');
const { createPanelPayload, createAdminPanelPayload } = require('../discord/panel');
const { autoSetupGuildChannels } = require('../discord/setup');
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

// In-Memory Rate Limiter Middleware
function createRateLimiter({ windowMs = 60000, max = 60, message = 'Demasiadas solicitudes. Por favor espera un momento.' }) {
  const hits = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (cleanup.unref) cleanup.unref();

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    let record = hits.get(ip);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(ip, record);
      return next();
    }
    record.count++;
    if (record.count > max) {
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      return res.status(429).json({ error: message, retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000) });
    }
    next();
  };
}

// Enviar log administrativo al canal configurado de una guild con mención de rol de alerta si corresponde
async function logToGuildAdminChannel(client, guildId, embed, isAlert = false) {
  try {
    const gConfig = db.forGuild(guildId).getConfig();
    const channelId = gConfig?.channels?.logsChannelId || (guildId === config.discord.guildId ? config.discord.logsChannelId : null);
    if (!channelId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
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
    console.error(`[Web Logs] Error al enviar log a guild ${guildId}:`, err.message);
  }
}

function createWebServer(client) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Rate Limiting Global y Específico
  const apiLimiter = createRateLimiter({ windowMs: 60000, max: 120, message: 'Demasiadas solicitudes a la API. Por favor espera un momento.' });
  const authLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 30, message: 'Demasiados intentos de acceso. Por favor espera unos minutos.' });
  const keyGenLimiter = createRateLimiter({ windowMs: 60000, max: 20, message: 'Ritmo excesivo de generación de licencias. Espera unos segundos.' });

  app.use('/api/', apiLimiter);
  app.use('/login', authLimiter);
  app.use('/auth/', authLimiter);

  // ── RUTAS DE AUTENTICACIÓN ──

  app.get('/', (req, res) => {
    const token = req.cookies?.session_token;
    if (token) {
      return res.redirect('/servers');
    }
    res.redirect('/login');
  });

  app.get('/login', (req, res) => {
    const errorMessage = req.query.error ? decodeURIComponent(req.query.error) : '';
    res.send(renderLoginPage(errorMessage));
  });

  // Iniciar flujo Discord OAuth2
  app.get('/auth/discord', (req, res) => {
    if (!config.web.clientSecret) {
      return res.send(renderLoginPage('Falta configurar DISCORD_CLIENT_SECRET en tu archivo .env. Consulta el panel de Discord Developer Portal para obtenerlo.'));
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
      const result = await exchangeDiscordCode(code, null, client, db);

      if (!result.authorized) {
        return res.redirect(`/login?error=${encodeURIComponent(result.error)}`);
      }

      res.cookie('session_token', result.sessionToken, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });
      res.redirect('/servers');
    } catch (err) {
      console.error('[OAuth2] Error en callback de Discord:', err.response?.data || err.message);
      const msg = err.response?.data?.error_description || err.message;
      res.redirect(`/login?error=${encodeURIComponent('Error al conectar con Discord: ' + msg)}`);
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

    if (session.user.isMasterOwner) {
      // El dueño maestro ve todos los servidores donde está el bot
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
      // Usuario administrador de Discord: lista sus servidores autorizados
      serversList = (session.authorizedGuilds || []).map((ag) => {
        const g = botGuilds.get(ag.id);
        const gDb = db.forGuild(ag.id);
        const data = gDb.getData();
        return {
          id: ag.id,
          name: ag.name,
          iconUrl: ag.iconUrl,
          botPresent: Boolean(g),
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
    let availableGuilds = [];
    if (req.session.user.isMasterOwner) {
      availableGuilds = db.getGuildList();
    } else {
      availableGuilds = (req.session.authorizedGuilds || []).map((ag) => ({
        id: ag.id,
        name: ag.name,
      }));
    }
    res.send(renderDashboardPage(req.session.user, guild, guildData, config.providers, availableGuilds));
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

  // 1b. Diagnóstico en Vivo de Plataformas
  app.get('/api/guilds/:guildId/health', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    try {
      const health = await providerManager.checkAllHealth(req.params.guildId, db);
      res.json(health);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Lista de Revendedores
  app.get('/api/guilds/:guildId/resellers', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const list = req.guildDb.getAllResellers();
    const enriched = await Promise.all(
      list.map(async (r) => {
        let tag = r.userId;
        let avatar = null;
        try {
          const user = await client.users.fetch(r.userId);
          tag = user.tag || user.username;
          avatar = user.displayAvatarURL({ size: 64, forceStatic: true });
        } catch (_) {}

        return {
          ...r,
          tag,
          avatar,
        };
      })
    );
    res.json(enriched);
  });

  // 3. Crear / Asignar Revendedor
  app.post('/api/guilds/:guildId/resellers', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const { userId, days, platforms, dailyLimit } = req.body;
    if (!userId || !days) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (userId, days).' });
    }

    const cleanUser = String(userId).replace(/[^0-9]/g, '');
    const numDays = parseInt(days, 10);
    if (isNaN(numDays) || numDays <= 0) {
      return res.status(400).json({ error: 'Días inválidos.' });
    }

    const limitNum = dailyLimit !== undefined && dailyLimit !== null && dailyLimit !== '' ? parseInt(dailyLimit, 10) : 0;
    const addedBy = req.user.username || 'Panel Web';
    const result = req.guildDb.setReseller(cleanUser, numDays, platforms, addedBy, limitNum);

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
          { name: 'Límite Diario', value: limitNum > 0 ? `${limitNum} keys/día` : 'Sin límite (Ilimitado)', inline: true },
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
    const keyauthBreakdown = req.guildDb.getStockBreakdown('keyauth');
    res.json({
      ...stock,
      keyauthBreakdown,
    });
  });

  // 6. Cargar Lote de Claves al Stock
  app.post('/api/guilds/:guildId/stock', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const { providerId, days, rawKeys } = req.body;
    if (!providerId || !rawKeys) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    if (providerId !== 'keyauth') {
      return res.status(400).json({ error: 'Solo KeyAuth (Elite Pro) requiere carga manual de stock. Las demás plataformas generan claves automáticamente vía API en tiempo real.' });
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

    // 1. Verificación de Anti-Flood (Burst Rate Limiter)
    const floodCheck = req.guildDb.checkAntiFlood(req.user.id);
    if (!floodCheck.allowed) {
      if (floodCheck.triggeredCooldown) {
        await logToGuildAdminChannel(
          client,
          guildId,
          new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle('🚨 [SEGURIDAD] Detección de Flood en Emisión Web')
            .setDescription('Se ha detectado una ráfaga anormal de peticiones (>3 en menos de 2 minutos).')
            .addFields(
              { name: 'Operador Web', value: `${req.user.username} (<@${req.user.id}>)`, inline: true },
              { name: 'Plataforma Solicitada', value: provider.name, inline: true },
              { name: 'Medida Aplicada', value: 'Enfriamiento de 10 minutos activado automáticamente.', inline: false }
            )
            .setFooter({ text: 'Sistema de Seguridad Anti-Spam • Auth Gateway' })
            .setTimestamp()
        );
        return res.status(429).json({ error: `🚨 Has superado el límite de emisión rápida (Anti-Flood). Tu cuenta ha entrado en enfriamiento por ${floodCheck.cooldownMinutes} minutos.` });
      }
      return res.status(429).json({ error: `⏳ Estás en enfriamiento por emisión rápida. Por favor espera ${floodCheck.remainingMinutes || 1} minuto(s).` });
    }

    // 2. Verificación de Cuota Diaria (Daily Quotas)
    const quotaCheck = req.guildDb.checkResellerQuota(req.user.id, Number(count));
    if (!quotaCheck.allowed) {
      if (quotaCheck.quotaExceeded) {
        return res.status(403).json({
          error: `⛔ Has alcanzado tu límite diario de licencias (${quotaCheck.usedToday}/${quotaCheck.dailyLimit} claves usadas hoy). Intenta de nuevo mañana.`,
        });
      }
      return res.status(403).json({ error: quotaCheck.error || 'No autorizado para emitir licencias.' });
    }

    try {
      const items = await provider.createKey({
        days: Number(days),
        count: Number(count),
        prefix,
        note,
      });

      // Registrar uso en Anti-Flood y Cuota Diaria
      req.guildDb.recordKeyBurst(req.user.id);
      req.guildDb.incrementResellerUsage(req.user.id, Number(count));

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

      // Generar plantilla de WhatsApp personalizada para este servidor con nombre de plataforma configurado
      const pMeta = req.guildDb.getProviderMetadata ? req.guildDb.getProviderMetadata(providerId) : null;
      const pDisplayName = pMeta?.name || provider.name;

      const forwardText = items
        .map((item) => {
          const val = typeof item === 'object' ? (item.username ? `${item.username}:1` : item.key) : item;
          const itemDays = typeof item === 'object' && item.days ? item.days : days;
          return req.guildDb.formatForwardTemplate({
            providerName: pDisplayName,
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
  app.post('/api/guilds/:guildId/config', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const { channels, customTemplate, providersConfig, branding, enabledProviders, providersMetadata } = req.body;
    const updated = req.guildDb.updateConfig({ channels, customTemplate, providersConfig, branding, enabledProviders, providersMetadata });
    providerManager.invalidateGuild(req.params.guildId);

    req.guildDb.recordWebAuditLog({
      operatorTag: req.user.username,
      operatorId: req.user.id,
      action: 'UPDATE_CONFIG',
      details: enabledProviders ? `Plataformas activas actualizadas: ${enabledProviders.join(', ')}` : (providersMetadata ? 'Nombres y descripciones de plataformas actualizados.' : 'Configuración de canales, credenciales o plantilla actualizada.'),
      ip: req.ip,
    });

    // Si se modificaron las plataformas activas, nombres/descripciones o color de marca, intentar actualizar el embed en Discord en vivo
    if (enabledProviders || providersMetadata || branding) {
      const panelChanId = updated.channels?.panelChannelId;
      if (panelChanId) {
        try {
          const ch = await client.channels.fetch(panelChanId);
          if (ch?.isTextBased()) {
            const msgs = await ch.messages.fetch({ limit: 15 });
            const existingPanel = msgs.find(m => m.author.id === client.user.id && m.embeds.some(e => e.title?.includes('SISTEMA DE LICENCIAS')));
            if (existingPanel) {
              await existingPanel.edit(createPanelPayload(req.params.guildId, db));
            }
          }
        } catch (_) {}
      }
    }

    // Si se configuró canal de voz, intentar conectar al canal inmediatamente
    if (channels?.voiceChannelId && client.connectToVoiceChannel) {
      const g = req.guild || client.guilds.cache.get(req.params.guildId);
      if (g) {
        client.connectToVoiceChannel(g, channels.voiceChannelId).catch(() => {});
      }
    }

    res.json({ success: true, config: updated });
  });

  // 12b. Descargar Respaldo JSON de este Servidor (1-Click Backup)
  app.get('/api/guilds/:guildId/backup', requireAuth, requireGuildAccess(client, db), (req, res) => {
    const data = req.guildDb.getData();
    const filename = `backup-servidor-${req.params.guildId}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  });

  // 12c. Descargar Respaldo Maestro de Todo el Sistema (Solo Dueño Principal)
  app.get('/api/backup/all', requireAuth, (req, res) => {
    if (!req.session.user.isMasterOwner) {
      return res.status(403).json({ error: 'Acceso restringido al Dueño Principal.' });
    }
    const backupFile = db.createBackup();
    if (!backupFile) {
      return res.status(500).json({ error: 'Error al generar el respaldo global.' });
    }
    const filename = `backup-master-${new Date().toISOString().slice(0, 10)}.json`;
    res.download(backupFile, filename);
  });

  // 12d. Obtener Canales y Roles de Discord de este Servidor (Para Selectores Desplegables)
  app.get('/api/guilds/:guildId/discord-channels', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const guild = req.guild || client.guilds.cache.get(req.params.guildId);
    if (!guild) {
      return res.status(404).json({ error: 'El bot no está presente en este servidor.' });
    }

    try {
      const textChannels = [];
      const voiceChannels = [];
      const roles = [];

      guild.channels.cache.forEach((c) => {
        if (c.isTextBased()) {
          textChannels.push({
            id: c.id,
            name: c.name,
            parentName: c.parent?.name || null,
          });
        } else if (c.isVoiceBased()) {
          voiceChannels.push({
            id: c.id,
            name: c.name,
            parentName: c.parent?.name || null,
          });
        }
      });

      textChannels.sort((a, b) => a.name.localeCompare(b.name));
      voiceChannels.sort((a, b) => a.name.localeCompare(b.name));

      guild.roles.cache.forEach((r) => {
        if (r.id !== guild.id && !r.managed) {
          roles.push({
            id: r.id,
            name: r.name,
            color: r.hexColor,
          });
        }
      });
      roles.sort((a, b) => a.name.localeCompare(b.name));

      res.json({ textChannels, voiceChannels, roles });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12e. Auto-Crear y Configurar Canales en 1 Clic (Asistente de Auto-Setup)
  app.post('/api/guilds/:guildId/auto-setup-channels', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const guild = req.guild || client.guilds.cache.get(req.params.guildId);
    if (!guild) {
      return res.status(404).json({ error: 'El bot no está presente en este servidor de Discord.' });
    }

    try {
      const result = await autoSetupGuildChannels(guild, client, db, `${req.user.username} (Panel Web)`);
      req.guildDb.recordWebAuditLog({
        operatorTag: req.user.username,
        operatorId: req.user.id,
        action: 'AUTO_SETUP_CHANNELS',
        details: 'Asistente de auto-creación ejecutado: categoría y 4 canales creados con paneles publicados.',
        ip: req.ip,
      });

      res.json(result);
    } catch (err) {
      console.error('[AutoSetup API Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 12f. Clonar Configuración de Otro Servidor
  app.post('/api/guilds/:guildId/clone-config', requireAuth, requireGuildAccess(client, db), (req, res) => {
    const { sourceGuildId } = req.body;
    const { guildId } = req.params;

    if (!sourceGuildId) {
      return res.status(400).json({ error: 'Debes seleccionar un servidor de origen.' });
    }

    if (sourceGuildId === guildId) {
      return res.status(400).json({ error: 'El servidor de origen no puede ser el mismo servidor actual.' });
    }

    if (!req.session.user.isMasterOwner) {
      const authorized = (req.session.authorizedGuilds || []).some((g) => g.id === sourceGuildId);
      if (!authorized) {
        return res.status(403).json({ error: 'No tienes permisos de administrador en el servidor de origen.' });
      }
    }

    try {
      const updated = req.guildDb.cloneConfigFrom(sourceGuildId, `${req.user.username} (Panel Web)`);
      providerManager.invalidateGuild(guildId);
      res.json({ success: true, config: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12g. Obtener Registro de Auditoría Web de este Servidor
  app.get('/api/guilds/:guildId/audit-logs', requireAuth, requireGuildAccess(client, db), (req, res) => {
    const logs = req.guildDb.getWebAuditLogs(50);
    res.json(logs);
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
      await channel.send(createPanelPayload(guildId, db));
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
      await channel.send(createAdminPanelPayload(guildId, db));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: `Error al publicar en Discord: ${err.message}` });
    }
  });

  // 14c. Conectar bot al canal de voz 24/7 de este servidor
  app.post('/api/guilds/:guildId/connect-voice', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const guild = req.guild || client.guilds.cache.get(req.params.guildId);
    if (!guild) {
      return res.status(404).json({ error: 'El bot no está presente en este servidor.' });
    }
    if (!client.connectToVoiceChannel) {
      return res.status(500).json({ error: 'El módulo de voz no está disponible en el bot.' });
    }

    try {
      const result = await client.connectToVoiceChannel(guild);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      req.guildDb.recordWebAuditLog({
        operatorTag: req.user.username,
        operatorId: req.user.id,
        action: 'CONNECT_VOICE',
        details: `Bot conectado al canal de voz "${result.channelName}" (${result.channelId}).`,
        ip: req.ip,
      });

      res.json({ success: true, channelName: result.channelName, channelId: result.channelId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. Lista de Administradores
  app.get('/api/guilds/:guildId/admins', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const adminIds = req.guildDb.getBotAdmins();
    const botOwnerId = config.discord.ownerId || '446349128650326021';

    const adminList = [];

    // Incluir al dueño maestro primero
    if (botOwnerId) {
      let ownerTag = 'Dueño Principal';
      let ownerAvatar = null;
      try {
        const u = await client.users.fetch(botOwnerId);
        ownerTag = u.tag || u.username;
        ownerAvatar = u.displayAvatarURL({ size: 64, forceStatic: true });
      } catch (_) {}
      adminList.push({
        userId: botOwnerId,
        tag: ownerTag,
        avatar: ownerAvatar,
        role: 'Dueño Maestro (Owner)',
        isOwner: true,
        canRemove: false
      });
    }

    for (const uid of adminIds) {
      if (uid === botOwnerId) continue;
      let tag = uid;
      let avatar = null;
      try {
        const u = await client.users.fetch(uid);
        tag = u.tag || u.username;
        avatar = u.displayAvatarURL({ size: 64, forceStatic: true });
      } catch (_) {}
      adminList.push({
        userId: uid,
        tag,
        avatar,
        role: 'Administrador del Bot',
        isOwner: false,
        canRemove: true
      });
    }

    res.json({ admins: adminList });
  });

  // 16. Nombrar Administrador (Solo Dueño)
  app.post('/api/guilds/:guildId/admins', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const isOwner = req.session.user.id === config.discord.ownerId || req.guild?.ownerId === req.session.user.id;
    if (!isOwner) {
      return res.status(403).json({ error: 'Solo el Dueño puede nombrar nuevos administradores.' });
    }

    const { userId } = req.body;
    const { guildId } = req.params;
    const cleanUser = String(userId || '').replace(/[^0-9]/g, '');

    if (!cleanUser) {
      return res.status(400).json({ error: 'Ingresa un ID de usuario válido o mención.' });
    }

    const added = req.guildDb.addBotAdmin(cleanUser);

    if (added) {
      await logToGuildAdminChannel(
        client,
        guildId,
        new EmbedBuilder()
          .setColor(0x16a34a)
          .setTitle('[ADMINISTRACIÓN] Asignación de Administrador')
          .addFields(
            { name: 'Operador', value: `${req.user.username} (Panel Web)`, inline: true },
            { name: 'Rango Operador', value: 'Dueño / Administrador', inline: true },
            { name: 'Usuario Designado', value: `<@${cleanUser}>`, inline: true },
            { name: 'Origen', value: 'Dashboard Web', inline: false }
          )
          .setFooter({ text: 'Sistema de Auditoría • Auth Gateway Web' })
          .setTimestamp()
      );
    }

    res.json({ success: true, added });
  });

  // 17. Revocar Administrador (Solo Dueño)
  app.delete('/api/guilds/:guildId/admins/:userId', requireAuth, requireGuildAccess(client, db), async (req, res) => {
    const isOwner = req.session.user.id === config.discord.ownerId || req.guild?.ownerId === req.session.user.id;
    if (!isOwner) {
      return res.status(403).json({ error: 'Solo el Dueño puede revocar administradores.' });
    }

    const { userId, guildId } = req.params;
    const removed = req.guildDb.removeBotAdmin(userId);

    if (removed) {
      await logToGuildAdminChannel(
        client,
        guildId,
        new EmbedBuilder()
          .setColor(0xdc2626)
          .setTitle('[ADMINISTRACIÓN] Revocación de Administrador')
          .addFields(
            { name: 'Operador', value: `${req.user.username} (Panel Web)`, inline: true },
            { name: 'Usuario Revocado', value: `<@${userId}>`, inline: true },
            { name: 'Origen', value: 'Dashboard Web', inline: false }
          )
          .setFooter({ text: 'Sistema de Auditoría • Auth Gateway Web' })
          .setTimestamp()
      );
    }

    res.json({ success: true, removed });
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
    console.log(`🔒 Autenticación: Exclusiva mediante Discord OAuth2`);
    console.log(`======================================================\n`);
  });

  return app;
}

module.exports = { createWebServer, startWebServer };
