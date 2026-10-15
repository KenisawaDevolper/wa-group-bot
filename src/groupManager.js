import logger from './logger.js';
import { getSocket } from './connection.js';
import { isGroupAdmin, isGroupOwner, isBotAdmin } from './permissions.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WARNINGS_PATH = join(__dirname, '..', 'database', 'warnings.json');

export async function participantExists(sock, groupId, userJid) {
  try {
    const metadata = await sock.groupMetadata(groupId);
    if (!metadata || !metadata.participants) return false;
    return metadata.participants.some(p => p.id === userJid);
  } catch (err) {
    logger.error('Error verificando participante:', err.message);
    return false;
  }
}

export async function kickParticipant(groupId, userJid) {
  const sock = getSocket();
  if (!sock) throw new Error('Sin conexión activa');

  const botAdmin = await isBotAdmin(sock, groupId);
  if (!botAdmin) throw new Error('El bot no es administrador del grupo');

  const targetAdmin = await isGroupAdmin(sock, groupId, userJid);
  if (targetAdmin) {
    const userIsOwner = await isGroupOwner(groupId, userJid);
    if (userIsOwner) throw new Error('No puedes expulsar al propietario del grupo');
  }

  const exists = await participantExists(sock, groupId, userJid);
  if (!exists) throw new Error('El participante no existe en el grupo');

  await sock.groupParticipantsUpdate(groupId, [userJid], 'remove');
  return true;
}

export async function promoteParticipant(groupId, userJid) {
  const sock = getSocket();
  if (!sock) throw new Error('Sin conexión activa');

  const botAdmin = await isBotAdmin(sock, groupId);
  if (!botAdmin) throw new Error('El bot no es administrador del grupo');

  const exists = await participantExists(sock, groupId, userJid);
  if (!exists) throw new Error('El participante no existe en el grupo');

  await sock.groupParticipantsUpdate(groupId, [userJid], 'promote');
  return true;
}

export async function demoteParticipant(groupId, userJid) {
  const sock = getSocket();
  if (!sock) throw new Error('Sin conexión activa');

  const botAdmin = await isBotAdmin(sock, groupId);
  if (!botAdmin) throw new Error('El bot no es administrador del grupo');

  const isOwner = await isGroupOwner(sock, groupId, userJid);
  if (isOwner) throw new Error('No puedes degradar al propietario del grupo');

  const exists = await participantExists(sock, groupId, userJid);
  if (!exists) throw new Error('El participante no existe en el grupo');

  await sock.groupParticipantsUpdate(groupId, [userJid], 'demote');
  return true;
}

export async function addParticipant(groupId, phoneNumber) {
  const sock = getSocket();
  if (!sock) throw new Error('Sin conexión activa');

  const botAdmin = await isBotAdmin(sock, groupId);
  if (!botAdmin) throw new Error('El bot no es administrador del grupo');

  const jid = phoneNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  const result = await sock.groupParticipantsUpdate(groupId, [jid], 'add');

  if (result[0]?.status === 403) throw new Error('WhatsApp rechazó la invitación (privacidad del usuario)');
  if (result[0]?.status === 409) throw new Error('El usuario ya está en el grupo');
  return true;
}

export async function setGroupAnnounce(groupId, restrict) {
  const sock = getSocket();
  if (!sock) throw new Error('Sin conexión activa');

  const botAdmin = await isBotAdmin(sock, groupId);
  if (!botAdmin) throw new Error('El bot no es administrador del grupo');

  await sock.groupSettingUpdate(groupId, restrict ? 'announcement' : 'not_announcement');
  return true;
}

export async function setGroupName(groupId, newName) {
  const sock = getSocket();
  if (!sock) throw new Error('Sin conexión activa');

  const botAdmin = await isBotAdmin(sock, groupId);
  if (!botAdmin) throw new Error('El bot no es administrador del grupo');

  await sock.groupUpdateSubject(groupId, newName);
  return true;
}

export async function setGroupDescription(groupId, description) {
  const sock = getSocket();
  if (!sock) throw new Error('Sin conexión activa');

  const botAdmin = await isBotAdmin(sock, groupId);
  if (!botAdmin) throw new Error('El bot no es administrador del grupo');

  await sock.groupUpdateDescription(groupId, description);
  return true;
}

export async function getGroupInviteLink(groupId) {
  const sock = getSocket();
  if (!sock) throw new Error('Sin conexión activa');

  const botAdmin = await isBotAdmin(sock, groupId);
  if (!botAdmin) throw new Error('El bot no es administrador del grupo');

  const code = await sock.groupInviteCode(groupId);
  return `https://chat.whatsapp.com/${code}`;
}

export async function resetGroupInviteLink(groupId) {
  const sock = getSocket();
  if (!sock) throw new Error('Sin conexión activa');

  const botAdmin = await isBotAdmin(sock, groupId);
  if (!botAdmin) throw new Error('El bot no es administrador del grupo');

  await sock.groupRevokeInvite(groupId);
  return true;
}

export async function getGroupInfo(groupId) {
  const sock = getSocket();
  if (!sock) throw new Error('Sin conexión activa');

  const metadata = await sock.groupMetadata(groupId);
  if (!metadata) throw new Error('No se pudieron obtener los metadatos');

  const admins = metadata.participants
    .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
    .map(p => p.id);

  return {
    name: metadata.subject,
    id: metadata.id,
    description: metadata.desc || 'Sin descripción',
    owner: metadata.owner,
    participantCount: metadata.participants.length,
    participants: metadata.participants,
    admins,
    createdAt: metadata.creation ? new Date(metadata.creation * 1000).toLocaleString() : 'Desconocido'
  };
}

export function getMentions(message) {
  const mentions = [];
  const msg = message?.message?.extendedTextMessage || message?.message;
  if (!msg) return mentions;

  const contextInfo = msg.contextInfo || message?.message?.extendedTextMessage?.contextInfo;
  if (contextInfo?.mentionedJid) {
    for (const jid of contextInfo.mentionedJid) {
      if (!mentions.includes(jid)) mentions.push(jid);
    }
  }

  const text = msg.text || msg.caption || '';
  const mentionRegex = /@([0-9]{5,15})/g;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const jid = match[1] + '@s.whatsapp.net';
    if (!mentions.includes(jid)) mentions.push(jid);
  }

  return mentions;
}

export async function tagAllParticipants(groupId, messageText = '', hide = false) {
  const sock = getSocket();
  if (!sock) throw new Error('Sin conexión activa');

  const metadata = await sock.groupMetadata(groupId);
  if (!metadata || !metadata.participants) throw new Error('No se pudieron obtener participantes');

  const botJid = sock.user?.id;
  const participants = metadata.participants
    .map(p => p.id)
    .filter(id => id !== botJid);

  if (participants.length === 0) throw new Error('No hay participantes para mencionar');

  if (hide) {
    const chunks = chunkArray(participants, 10);
    for (const chunk of chunks) {
      await sock.sendMessage(groupId, {
        text: messageText || '📢 Atención',
        mentions: chunk
      });
    }
  } else {
    const mentionsList = participants.map(id => `@${id.split('@')[0]}`).join(' ');
    await sock.sendMessage(groupId, {
      text: `${messageText}\n\n${mentionsList}`,
      mentions: participants
    });
  }

  return participants.length;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function loadWarnings() {
  try {
    if (!existsSync(WARNINGS_PATH)) {
      mkdirSync(dirname(WARNINGS_PATH), { recursive: true });
      writeFileSync(WARNINGS_PATH, '{}', 'utf-8');
      return {};
    }
    const raw = readFileSync(WARNINGS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error('Error cargando advertencias:', err.message);
    return {};
  }
}

export function saveWarnings(data) {
  try {
    mkdirSync(dirname(WARNINGS_PATH), { recursive: true });
    writeFileSync(WARNINGS_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    logger.error('Error guardando advertencias:', err.message);
    return false;
  }
}

export function addWarning(groupId, userJid, reason, adminJid) {
  const data = loadWarnings();
  if (!data[groupId]) data[groupId] = {};
  if (!data[groupId][userJid]) data[groupId][userJid] = [];

  data[groupId][userJid].push({
    reason: reason || 'Sin motivo',
    date: new Date().toISOString(),
    admin: adminJid
  });

  saveWarnings(data);
  return data[groupId][userJid].length;
}

export function getWarnings(groupId, userJid) {
  const data = loadWarnings();
  if (!data[groupId] || !data[groupId][userJid]) return [];
  return data[groupId][userJid];
}

export function resetWarnings(groupId, userJid) {
  const data = loadWarnings();
  if (!data[groupId] || !data[groupId][userJid]) return false;

  data[groupId][userJid] = [];
  saveWarnings(data);
  return true;
}

export default {
  participantExists,
  kickParticipant,
  promoteParticipant,
  demoteParticipant,
  addParticipant,
  setGroupAnnounce,
  setGroupName,
  setGroupDescription,
  getGroupInviteLink,
  resetGroupInviteLink,
  getGroupInfo,
  getMentions,
  tagAllParticipants,
  loadWarnings,
  saveWarnings,
  addWarning,
  getWarnings,
  resetWarnings
};
