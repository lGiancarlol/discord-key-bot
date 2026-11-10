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

async function exchangeDiscordCode(code, redirectUri) {
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

  // Filtrar servidores donde el usuario es Dueño o tiene permisos de Administrador (0x8) o Gestionar Servidor (0x20)
  const adminGuilds = rawGuilds.filter((g) => {
    if (g.owner) return true;
    const perms = BigInt(g.permissions || 0);
    const ADMINISTRATOR = BigInt(0x8);
    const MANAGE_GUILD = BigInt(0x20);
    return (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & MANAGE_GUILD) === MANAGE_GUILD;
  });

  const sessionToken = generateSessionToken();
  const sessionData = {
    token: sessionToken,
    type: 'discord',
    user: {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      global_name: user.global_name,
      avatar: user.avatar,
      avatarUrl: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png',
    },
    adminGuilds: adminGuilds.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      owner: g.owner,
      iconUrl: g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
        : null,
    })),
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
  };

  activeSessions.set(sessionToken, sessionData);
  return { sessionToken, sessionData };
}

function createMasterSession() {
  const sessionToken = generateSessionToken();
  const sessionData = {
    token: sessionToken,
    type: 'master',
    user: {
      id: 'master_admin',
      username: 'Administrador Principal',
      global_name: 'Master Admin',
      avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
    },
    adminGuilds: [], // Acceso a todos los servidores del bot
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  activeSessions.set(sessionToken, sessionData);
  return { sessionToken, sessionData };
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
      return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
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

    // Si es Master Admin tiene acceso universal
    if (session.type === 'master') {
      req.guildDb = db.forGuild(guildId);
      req.guild = client?.guilds.cache.get(guildId) || null;
      return next();
    }

    // Verificar si el usuario es admin en este servidor de Discord
    const isDiscordAdmin = session.adminGuilds?.some((g) => g.id === guildId);
    const isBotAdmin = db.forGuild(guildId).isBotAdmin(session.user.id);
    const isOwner = client?.guilds.cache.get(guildId)?.ownerId === session.user.id;

    if (!isDiscordAdmin && !isBotAdmin && !isOwner) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'No tienes permisos de administrador en este servidor.' });
      }
      return res.status(403).send('<h1>403 Prohibido</h1><p>No tienes permisos de administración en este servidor.</p><a href="/servers">Volver</a>');
    }

    req.guildDb = db.forGuild(guildId);
    req.guild = client?.guilds.cache.get(guildId) || null;
    next();
  };
}

module.exports = {
  getDiscordAuthUrl,
  exchangeDiscordCode,
  createMasterSession,
  getSession,
  destroySession,
  requireAuth,
  requireGuildAccess,
};
