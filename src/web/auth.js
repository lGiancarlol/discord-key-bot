const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');

// Almacén en memoria para sesiones activas
const activeSessions = new Map();

// Limpiar sesiones expiradas cada hora
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt <= now) {
      activeSessions.delete(token);
    }
  }
}, 60 * 60 * 1000);

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getDiscordAuthUrl(redirectUri) {
  const params = new URLSearchParams({
    client_id: config.web.clientId,
    redirect_uri: redirectUri || config.web.redirectUri,
    response_type: 'code',
    scope: 'identify guilds',
    prompt: 'consent',
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

async function exchangeDiscordCode(code, redirectUri, client, db) {
  const params = new URLSearchParams({
    client_id: config.web.clientId,
    client_secret: config.web.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri || config.web.redirectUri,
  });

  const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  const { access_token } = tokenRes.data;

  // Obtener perfil del usuario
  const userRes = await axios.get('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${access_token}` },
    timeout: 10000,
  });

  // Obtener servidores del usuario
  const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${access_token}` },
    timeout: 10000,
  });

  const user = userRes.data;
  const rawGuilds = guildsRes.data || [];

  // Verificar si es el Dueño Principal del Bot o tiene permiso explícito por ID
  const isMasterOwner = user.id === config.discord.ownerId;
  const isWebAllowed = isMasterOwner || db.isWebUserAllowed(user.id);

  // Si NO es el Dueño Maestro y NO está en la lista de acceso web autorizada
  if (!isWebAllowed) {
    return {
      authorized: false,
      user,
      error: `Acceso restringido: El panel web está reservado exclusivamente para el Dueño del Bot y cuentas autorizadas por ID. Tu ID de Discord es: ${user.id}. Solicita autorización al dueño (<@${config.discord.ownerId}>) para poder ingresar.`,
    };
  }

  // Filtrar servidores donde tiene acceso
  const authorizedGuilds = [];
  const botGuilds = client?.guilds?.cache || new Map();

  for (const [guildId, guild] of botGuilds.entries()) {
    // Solo el Dueño Maestro o usuarios expresamente autorizados para este servidor
    const hasGuildAccess = isMasterOwner || db.canUserAccessGuildWeb(user.id, guildId);

    if (hasGuildAccess) {
      authorizedGuilds.push({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        iconUrl: guild.iconURL ? guild.iconURL() : null,
        owner: isMasterOwner,
        isMaster: isMasterOwner,
      });
    }
  }

  // Si no tiene acceso a ningún servidor
  if (authorizedGuilds.length === 0) {
    return {
      authorized: false,
      user,
      error: `Tu cuenta de Discord (@${user.username} • ID: ${user.id}) tiene acceso web aprobado pero no tiene ningún servidor asignado actualmente. Contacta al Dueño (<@${config.discord.ownerId}>).`,
    };
  }

  const sessionToken = generateSessionToken();
  const sessionData = {
    token: sessionToken,
    type: 'discord',
    user: {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      global_name: user.global_name || user.username,
      avatar: user.avatar,
      avatarUrl: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png',
      isMasterOwner,
    },
    authorizedGuilds,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
  };

  activeSessions.set(sessionToken, sessionData);
  return { authorized: true, sessionToken, sessionData };
}

function getSession(token) {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

function destroySession(token) {
  if (token) activeSessions.delete(token);
}

// Middleware para verificar autenticación en la web
function requireAuth(req, res, next) {
  const token = req.cookies?.session_token;
  const session = getSession(token);
  if (!session) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'No autorizado. Inicia sesión con Discord.' });
    }
    return res.redirect('/login');
  }
  req.session = session;
  req.user = session.user;
  next();
}

// Middleware para validar que el usuario tenga acceso a un servidor en particular
function requireGuildAccess(client, db) {
  return (req, res, next) => {
    const guildId = req.params.guildId || req.body?.guildId || req.query?.guildId;
    if (!guildId) {
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({ error: 'guildId requerido.' });
      }
      return res.redirect('/servers');
    }

    const session = req.session;
    const userId = session.user.id;

    // Dueño maestro tiene acceso total
    if (session.user.isMasterOwner || userId === config.discord.ownerId) {
      req.guildDb = db.forGuild(guildId);
      req.guild = client?.guilds.cache.get(guildId) || null;
      return next();
    }

    // Verificar si el usuario está explícitamente autorizado en la whitelist web para este servidor
    if (!db.canUserAccessGuildWeb(userId, guildId)) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Acceso denegado: No tienes autorización para acceder a este servidor en el panel web.' });
      }
      return res.status(403).send('<h1>403 Prohibido</h1><p>Acceso denegado. Solo el Dueño del Bot puede concederte acceso a este servidor mediante tu ID de Discord.</p><a href="/servers">Volver</a>');
    }

    req.guildDb = db.forGuild(guildId);
    req.guild = client?.guilds.cache.get(guildId) || null;
    next();
  };
}

module.exports = {
  getDiscordAuthUrl,
  exchangeDiscordCode,
  getSession,
  destroySession,
  requireAuth,
  requireGuildAccess,
};
