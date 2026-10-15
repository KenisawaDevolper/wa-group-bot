import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import logger from './logger.js';
import { loadConfig } from './config.js';

let sock = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let messageHandler = null;
let pairingCode = null;

export async function connectBot(onMessage) {
  if (isConnecting) {
    logger.warn('Ya hay una conexión en curso');
    return null;
  }

  if (sock) {
    logger.warn('Ya existe una conexión activa');
    return sock;
  }

  isConnecting = true;
  messageHandler = onMessage;

  try {
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: false,
      logger: logger.child({ module: 'baileys' }),
      browser: ['WA Group Bot', 'Chrome', '1.0.0'],
      markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      handleConnectionUpdate(update);
    });

    sock.ev.on('messages.upsert', async (m) => {
      if (messageHandler && m.messages && m.messages.length > 0) {
        for (const msg of m.messages) {
          if (msg.key && msg.key.id) {
            await messageHandler(msg);
          }
        }
      }
    });

    sock.ev.on('group-participants.update', async (update) => {
      try {
        const { id, participants, action } = update;
        if (!id || !participants || participants.length === 0) return;

        const { handleParticipantEvent } = await import('../plugins/group/welcome.js');
        await handleParticipantEvent(id, participants, action);
      } catch (err) {
        logger.error('Error en evento de participantes:', err.message);
      }
    });

    logger.info('Iniciando conexión con WhatsApp...');
    return sock;

  } catch (err) {
    logger.error('Error conectando:', err.message);
    isConnecting = false;
    sock = null;
    throw err;
  }
}

function handleConnectionUpdate(update) {
  const { connection, lastDisconnect } = update;

  if (connection === 'open') {
    logger.info('Conexión establecida con WhatsApp');
    isConnecting = false;
    reconnectAttempts = 0;

    if (!sock.authState?.creds?.me?.id) {
      generatePairingCode();
    } else {
      pairingCode = null;
    }
  }

  if (connection === 'close') {
    isConnecting = false;
    const statusCode = lastDisconnect?.error?.output?.statusCode;

    if (statusCode === DisconnectReason.loggedOut) {
      logger.error('Sesión cerrada por el usuario. Elimina sessions/ para reconectar.');
      sock = null;
      return;
    }

    if (!sock.authState?.creds?.me?.id) {
      generatePairingCode();
    }
  }
}

async function generatePairingCode() {
  if (!sock) return;
  try {
    const code = await sock.requestPairingCode('5491164431320');
    pairingCode = code;
    logger.info(`Código de emparejamiento: ${code}`);
    logger.info('Ingresa este código en WhatsApp > Dispositivos vinculados > Vincular dispositivo');
  } catch (err) {
    logger.error('Error generando código de emparejamiento:', err.message);
    if (messageHandler) connectBot(messageHandler);
  }
}

export async function disconnectBot() {
  if (!sock) {
    logger.warn('No hay conexión activa para desconectar');
    return;
  }

  try {
    logger.info('Cerrando conexión...');
    sock.end(undefined);
    sock = null;
    isConnecting = false;
    reconnectAttempts = 0;
    logger.info('Conexión cerrada correctamente');
  } catch (err) {
    logger.error('Error desconectando:', err.message);
  }
}

export function isConnected() {
  return sock !== null && sock.user !== undefined;
}

export function getConnectionState() {
  if (!sock) return 'disconnected';
  if (sock.user) return 'connected';
  if (isConnecting) return 'connecting';
  return 'disconnected';
}

export function getPairingCode() {
  return pairingCode;
}

export function getSocket() {
  return sock;
}

export default { connectBot, disconnectBot, isConnected, getConnectionState, getPairingCode, getSocket };
