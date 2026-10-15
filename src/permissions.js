import logger from './logger.js';

export async function isGroupAdmin(sock, groupId, userJid) {
  try {
    if (!sock || !groupId || !userJid) return false;

    const groupMetadata = await sock.groupMetadata(groupId);
    if (!groupMetadata || !groupMetadata.participants) return false;

    const participant = groupMetadata.participants.find(p => p.id === userJid);
    if (!participant) return false;

    return participant.admin === 'admin' || participant.admin === 'superadmin';
  } catch (err) {
    logger.error('Error verificando admin de grupo:', err.message);
    return false;
  }
}

export async function isGroupOwner(sock, groupId, userJid) {
  try {
    if (!sock || !groupId || !userJid) return false;

    const groupMetadata = await sock.groupMetadata(groupId);
    if (!groupMetadata || !groupMetadata.owner) return false;

    return groupMetadata.owner === userJid;
  } catch (err) {
    logger.error('Error verificando owner:', err.message);
    return false;
  }
}

export async function isBotAdmin(sock, groupId) {
  try {
    if (!sock || !groupId) return false;

    const botJid = sock.user?.id;
    if (!botJid) return false;

    const groupMetadata = await sock.groupMetadata(groupId);
    if (!groupMetadata || !groupMetadata.participants) return false;

    const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
    if (!botParticipant) return false;

    return botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin';
  } catch (err) {
    logger.error('Error verificando bot admin:', err.message);
    return false;
  }
}

export function isOwner(userJid, ownerJid) {
  if (!userJid || !ownerJid) return false;
  return userJid === ownerJid;
}

export default { isGroupAdmin, isGroupOwner, isBotAdmin, isOwner };
