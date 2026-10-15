import logger from './logger.js';
import { isGroupAdmin, isGroupOwner, isBotAdmin, isOwner } from './permissions.js';
import { loadConfig } from './config.js';
import { getSocket } from './connection.js';

export async function buildContext(message) {
  const sock = getSocket();
  const config = loadConfig();

  if (!message) {
    throw new Error('buildContext requiere un mensaje');
  }

  const remoteJid = message.key?.remoteJid || null;
  const sender = message.key?.participant || remoteJid || null;
  const isGroup = remoteJid?.endsWith('@g.us') || false;
  const botJid = sock?.user?.id || null;

  let command = '';
  let args = [];
  let body = '';

  if (message.message) {
    const msgType = Object.keys(message.message)[0];
    if (msgType === 'conversation') {
      body = message.message.conversation || '';
    } else if (msgType === 'extendedTextMessage') {
      body = message.message.extendedTextMessage?.text || '';
    } else if (msgType === 'imageMessage') {
      body = message.message.imageMessage?.caption || '';
    } else if (msgType === 'videoMessage') {
      body = message.message.videoMessage?.caption || '';
    }
  }

  if (body.startsWith(config.prefix)) {
    const parts = body.slice(config.prefix.length).trim().split(/\s+/);
    command = parts[0]?.toLowerCase() || '';
    args = parts.slice(1);
  }

  let admin = false;
  let botAdmin = false;
  let owner = false;

  if (isGroup && remoteJid) {
    admin = await isGroupAdmin(sock, remoteJid, sender);
    botAdmin = await isBotAdmin(sock, remoteJid);
  }

  owner = isOwner(sender, config.owner);

  const reply = async (text, options = {}) => {
    try {
      await sock.sendMessage(remoteJid, { text, ...options }, { quoted: message });
    } catch (err) {
      logger.error('Error enviando reply:', err.message);
    }
  };

  const sendMessage = async (jid, text, options = {}) => {
    try {
      await sock.sendMessage(jid, { text, ...options });
    } catch (err) {
      logger.error('Error enviando mensaje:', err.message);
    }
  };

  return {
    message,
    sender,
    chat: remoteJid,
    command,
    args,
    body,
    isGroup,
    isAdmin: admin,
    isBotAdmin: botAdmin,
    isOwner: owner,
    reply,
    sendMessage,
    config,
    botJid,
    prefix: config.prefix
  };
}

export default { buildContext };
