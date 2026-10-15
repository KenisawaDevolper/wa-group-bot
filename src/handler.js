import logger from './logger.js';
import { buildContext } from './context.js';
import { routeCommand, isDuplicateMessage } from './commandRouter.js';
import { getSocket } from './connection.js';
import { loadConfig } from './config.js';

const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 30;

function isRateLimited(sender) {
  const now = Date.now();
  const record = rateLimiter.get(sender);

  if (!record) {
    rateLimiter.set(sender, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (now > record.resetAt) {
    rateLimiter.set(sender, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return true;
  }

  record.count++;
  return false;
}

export async function handleMessage(message) {
  try {
    const sock = getSocket();
    if (!sock) {
      logger.warn('No hay conexión activa, mensaje ignorado');
      return;
    }

    const messageId = message.key?.id;
    if (!messageId) return;

    if (isDuplicateMessage(messageId)) {
      return;
    }

    const remoteJid = message.key?.remoteJid;
    const sender = message.key?.participant || remoteJid;

    if (!remoteJid || !sender) return;

    const botJid = sock.user?.id;
    if (sender === botJid) {
      return;
    }

    if (sender === 'status@broadcast') return;

    if (isRateLimited(sender)) {
      logger.warn(`Rate limit excedido para ${sender}`);
      return;
    }

    const config = loadConfig();
    const body = extractBody(message);

    if (remoteJid?.endsWith('@g.us')) {
      try {
        const { checkAndModerateMessage } = await import('../plugins/group/antilink.js');
        await checkAndModerateMessage(remoteJid, message);
      } catch (err) {
        logger.error('Error en antilink:', err.message);
      }
    }

    if (!body || !body.startsWith(config.prefix)) return;

    const ctx = await buildContext(message);
    if (!ctx.command) return;

    const result = routeCommand(ctx.command, ctx, ctx.args);

    if (!result.handled) {
      return;
    }

    if (result.type === 'plugin') {
      try {
        await result.execute(result.ctx);
      } catch (err) {
        logger.error(`Error ejecutando plugin "${result.plugin}": ${err.message}`);
        await ctx.reply('❌ Ocurrió un error al ejecutar el comando.');
      }
    }

  } catch (err) {
    logger.error('Error procesando mensaje:', err.message);
  }
}

function extractBody(message) {
  if (!message.message) return null;

  const msgType = Object.keys(message.message)[0];

  switch (msgType) {
    case 'conversation':
      return message.message.conversation || null;
    case 'extendedTextMessage':
      return message.message.extendedTextMessage?.text || null;
    case 'imageMessage':
      return message.message.imageMessage?.caption || null;
    case 'videoMessage':
      return message.message.videoMessage?.caption || null;
    case 'documentMessage':
      return message.message.documentMessage?.caption || null;
    default:
      return null;
  }
}

export function getRateLimitStatus(sender) {
  return rateLimiter.get(sender) || null;
}

export function clearRateLimits() {
  rateLimiter.clear();
}

export default { handleMessage, getRateLimitStatus, clearRateLimits };
