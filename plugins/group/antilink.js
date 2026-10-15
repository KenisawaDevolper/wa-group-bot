import logger from '../../src/logger.js';
import { getSocket } from '../../src/connection.js';
import { isGroupAdmin, isBotAdmin } from '../../src/permissions.js';
import {
  getGroupAntilinkConfig,
  toggleAntilink,
  setAntilinkAction,
  addAllowedDomain,
  removeAllowedDomain,
  addBlockedDomain,
  removeBlockedDomain
} from '../../database/antilinkConfig.js';
import { addWarning } from '../../src/groupManager.js';

const MAX_DOMAIN_LENGTH = 253;

const URL_REGEX = /(?:https?:\/\/(?:www\.)?|www\.)[^\s<>"{}|\\^`[\]]+|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s<>"{}|\\^`[\]]*)?/gi;
const WHATSAPP_INVITE_REGEX = /(?:https?:\/\/)?(?:chat|api)\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9]{20,})/i;

export function detectLinks(text) {
  if (!text || typeof text !== 'string') return [];

  const links = [];
  const seen = new Set();

  const urlMatches = text.match(URL_REGEX) || [];
  for (const match of urlMatches) {
    const normalized = match.toLowerCase().replace(/[.,;:!?]+$/, '');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      links.push(normalized);
    }
  }

  const waMatches = text.match(new RegExp(WHATSAPP_INVITE_REGEX, 'g')) || [];
  for (const match of waMatches) {
    const normalized = match.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      links.push(normalized);
    }
  }

  return links;
}

export function isDomainAllowed(domain, allowedDomains) {
  if (!domain || !allowedDomains || allowedDomains.length === 0) return false;
  const normalized = domain.toLowerCase();
  return allowedDomains.some(allowed => {
    const a = allowed.toLowerCase();
    return normalized === a || normalized.endsWith('.' + a);
  });
}

export function isDomainBlocked(domain, blockedDomains) {
  if (!domain || !blockedDomains || blockedDomains.length === 0) return false;
  const normalized = domain.toLowerCase();
  return blockedDomains.some(blocked => {
    const b = blocked.toLowerCase();
    return normalized === b || normalized.endsWith('.' + b);
  });
}

export function extractDomain(url) {
  try {
    let cleaned = url.toLowerCase().trim();
    cleaned = cleaned.replace(/^[a-z]+:\/\//, '');
    cleaned = cleaned.replace(/^www\./, '');
    const slashIndex = cleaned.indexOf('/');
    if (slashIndex !== -1) cleaned = cleaned.substring(0, slashIndex);
    return cleaned;
  } catch {
    return null;
  }
}

export function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  if (domain.length > MAX_DOMAIN_LENGTH) return false;
  if (domain.includes(' ')) return false;
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

async function deleteMessage(groupId, message) {
  const sock = getSocket();
  if (!sock) return false;

  try {
    await sock.sendMessage(groupId, { delete: message.key });
    return true;
  } catch (err) {
    logger.error('Error eliminando mensaje:', err.message);
    return false;
  }
}

async function kickParticipant(groupId, userJid) {
  const sock = getSocket();
  if (!sock) return false;

  try {
    await sock.groupParticipantsUpdate(groupId, [userJid], 'remove');
    return true;
  } catch (err) {
    logger.error('Error expulsando participante:', err.message);
    return false;
  }
}

async function moderateMessage(groupId, message, linkFound) {
  const config = getGroupAntilinkConfig(groupId);
  if (!config.antilinkEnabled) return;

  const sender = message.key?.participant || message.key?.remoteJid;
  if (!sender) return;

  const sock = getSocket();
  if (!sock) return;

  if (sender === sock.user?.id) return;

  const isAdmin = await isGroupAdmin(sock, groupId, sender);
  if (isAdmin) return;

  const action = config.antilinkAction || 'delete';

  if (action === 'delete') {
    const botAdmin = await isBotAdmin(sock, groupId);
    if (!botAdmin) {
      logger.warn('Antilink: delete no ejecutado, el bot no es administrador');
      try {
        await sock.sendMessage(groupId, {
          text: '⚠️ El bot necesita permisos de administrador para eliminar mensajes con antilink.'
        });
      } catch (err) {
        logger.error('Error notificando falta de permisos:', err.message);
      }
      return;
    }
    const deleted = await deleteMessage(groupId, message);
    if (deleted) {
      logger.info(`Antilink: mensaje eliminado de ${sender} en ${groupId} — enlace: ${linkFound}`);
    }
  } else if (action === 'warn') {
    const reason = `Enlace no permitido: ${linkFound}`;
    const total = addWarning(groupId, sender, reason, sock.user?.id);
    try {
      await sock.sendMessage(groupId, {
        text: `⚠️ @${sender.split('@')[0]} enlace no permitido.\nMotivo: ${reason}\nAdvertencias: ${total}`,
        mentions: [sender]
      });
    } catch (err) {
      logger.error('Error enviando advertencia antilink:', err.message);
    }
    logger.info(`Antilink: advertencia a ${sender} en ${groupId} — enlace: ${linkFound}`);
  } else if (action === 'kick') {
    const botAdmin = await isBotAdmin(sock, groupId);
    if (!botAdmin) {
      logger.warn('Antilink: kick no ejecutado, el bot no es administrador');
      return;
    }

    const targetAdmin = await isGroupAdmin(sock, groupId, sender);
    if (targetAdmin) return;

    const kicked = await kickParticipant(groupId, sender);
    if (kicked) {
      logger.info(`Antilink: ${sender} expulsado de ${groupId} — enlace: ${linkFound}`);
    }
  }
}

export async function checkAndModerateMessage(groupId, message) {
  if (!groupId || !message) return;

  const text = extractMessageText(message);
  if (!text) return;

  const config = getGroupAntilinkConfig(groupId);
  if (!config.antilinkEnabled) return;

  const links = detectLinks(text);
  if (links.length === 0) return;

  for (const link of links) {
    const domain = extractDomain(link);
    if (domain && isDomainAllowed(domain, config.allowedDomains)) {
      return;
    }
  }

  const blockedHit = links.some(link => {
    const domain = extractDomain(link);
    return domain && isDomainBlocked(domain, config.blockedDomains);
  });

  if (config.blockedDomains.length > 0 && !blockedHit && !links.some(l => l.includes('whatsapp.com'))) {
    return;
  }

  await moderateMessage(groupId, message, links[0]);
}

function extractMessageText(message) {
  if (!message.message) return null;
  const msg = message.message;

  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption;
  if (msg.documentMessage?.caption) return msg.documentMessage.caption;

  return null;
}

export default {
  name: 'antilink',
  description: 'Protección contra enlaces no permitidos',
  commands: ['antilink'],
  aliases: ['antienlace', 'antilinks'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    if (!ctx.isAdmin) {
      await ctx.reply('❌ Necesitas ser administrador para configurar antilink.');
      return;
    }

    const subCommand = ctx.args[0]?.toLowerCase() || '';
    const config = getGroupAntilinkConfig(ctx.chat);

    switch (subCommand) {
      case 'on':
        toggleAntilink(ctx.chat, true);
        await ctx.reply('✅ Antilink activado.');
        break;

      case 'off':
        toggleAntilink(ctx.chat, false);
        await ctx.reply('✅ Antilink desactivado.');
        break;

      case 'action': {
        const action = ctx.args[1]?.toLowerCase();
        if (!['delete', 'warn', 'kick'].includes(action)) {
          await ctx.reply('❌ Acción no válida.\nUso: ' + ctx.prefix + 'antilink action <delete|warn|kick>');
          return;
        }
        setAntilinkAction(ctx.chat, action);
        await ctx.reply(`✅ Acción antilink cambiada a: ${action}`);
        break;
      }

      case 'allow': {
        const domain = ctx.args[1]?.toLowerCase();
        if (!isValidDomain(domain)) {
          await ctx.reply('❌ Dominio no válido.');
          return;
        }
        addAllowedDomain(ctx.chat, domain);
        await ctx.reply(`✅ Dominio permitido: ${domain}`);
        break;
      }

      case 'disallow': {
        const domain = ctx.args[1]?.toLowerCase();
        if (!isValidDomain(domain)) {
          await ctx.reply('❌ Dominio no válido.');
          return;
        }
        removeAllowedDomain(ctx.chat, domain);
        await ctx.reply(`✅ Dominio permitido eliminado: ${domain}`);
        break;
      }

      case 'block': {
        const domain = ctx.args[1]?.toLowerCase();
        if (!isValidDomain(domain)) {
          await ctx.reply('❌ Dominio no válido.');
          return;
        }
        addBlockedDomain(ctx.chat, domain);
        await ctx.reply(`✅ Dominio bloqueado: ${domain}`);
        break;
      }

      case 'unblock': {
        const domain = ctx.args[1]?.toLowerCase();
        if (!isValidDomain(domain)) {
          await ctx.reply('❌ Dominio no válido.');
          return;
        }
        removeBlockedDomain(ctx.chat, domain);
        await ctx.reply(`✅ Dominio desbloqueado: ${domain}`);
        break;
      }

      case 'status': {
        let status = `🛡️ *Estado Antilink*\n`;
        status += `━━━━━━━━━━━━━━━━━━\n`;
        status += `Estado: ${config.antilinkEnabled ? '✅ Activado' : '❌ Desactivado'}\n`;
        status += `Acción: ${config.antilinkAction}\n`;
        status += `Dominios permitidos: ${config.allowedDomains.length > 0 ? config.allowedDomains.join(', ') : 'Ninguno'}\n`;
        status += `Dominios bloqueados: ${config.blockedDomains.length > 0 ? config.blockedDomains.join(', ') : 'Ninguno'}`;
        await ctx.reply(status);
        break;
      }

      default:
        await ctx.reply(
          'Uso: ' + ctx.prefix + 'antilink <on|off|action|allow|disallow|block|unblock|status>\n\n' +
          'on — Activar\n' +
          'off — Desactivar\n' +
          'action <delete|warn|kick> — Configurar acción\n' +
          'allow <dominio> — Permitir dominio\n' +
          'disallow <dominio> — Quitar dominio permitido\n' +
          'block <dominio> — Bloquear dominio\n' +
          'unblock <dominio> — Desbloquear dominio\n' +
          'status — Ver configuración'
        );
    }
  }
};


