import logger from '../../src/logger.js';
import { getSocket } from '../../src/connection.js';
import {
  getGroupWelcomeConfig,
  toggleWelcome,
  toggleGoodbye,
  setWelcomeMessage,
  setGoodbyeMessage,
  DEFAULT_WELCOME,
  DEFAULT_GOODBYE
} from '../../database/welcomeConfig.js';

const MAX_MESSAGE_LENGTH = 4096;

function replaceVariables(template, variables) {
  let result = template;

  const replacements = {
    '{user}': variables.user || 'usuario',
    '{mention}': variables.mention || '',
    '{group}': variables.group || 'el grupo',
    '{description}': variables.description || 'Sin descripción',
    '{count}': String(variables.count || 0),
    '{date}': variables.date || new Date().toLocaleDateString(),
    '{time}': variables.time || new Date().toLocaleTimeString()
  };

  for (const [key, value] of Object.entries(replacements)) {
    result = result.split(key).join(value);
  }

  return result;
}

async function getGroupVariables(groupId, participantJid) {
  const sock = getSocket();
  let groupName = 'el grupo';
  let description = 'Sin descripción';
  let count = 0;

  try {
    if (sock) {
      const metadata = await sock.groupMetadata(groupId);
      if (metadata) {
        groupName = metadata.subject || 'el grupo';
        description = metadata.desc || 'Sin descripción';
        count = metadata.participants?.length || 0;
      }
    }
  } catch (err) {
    logger.error('Error obteniendo datos del grupo para bienvenida:', err.message);
  }

  const userNumber = participantJid?.split('@')[0] || 'usuario';
  const mention = participantJid ? `@${userNumber}` : '';

  return {
    user: userNumber,
    mention,
    group: groupName,
    description,
    count,
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString()
  };
}

async function sendWelcomeMessage(groupId, participantJid) {
  const sock = getSocket();
  if (!sock) return;

  const config = getGroupWelcomeConfig(groupId);
  if (!config.welcomeEnabled) return;

  try {
    const variables = await getGroupVariables(groupId, participantJid);
    const message = replaceVariables(config.welcomeMessage, variables);

    await sock.sendMessage(groupId, {
      text: message,
      mentions: participantJid ? [participantJid] : []
    });

    logger.info(`Bienvenida enviada a ${participantJid} en ${groupId}`);
  } catch (err) {
    logger.error('Error enviando bienvenida:', err.message);
  }
}

async function sendGoodbyeMessage(groupId, participantJid) {
  const sock = getSocket();
  if (!sock) return;

  const config = getGroupWelcomeConfig(groupId);
  if (!config.goodbyeEnabled) return;

  try {
    const variables = await getGroupVariables(groupId, participantJid);
    const message = replaceVariables(config.goodbyeMessage, variables);

    await sock.sendMessage(groupId, {
      text: message,
      mentions: participantJid ? [participantJid] : []
    });

    logger.info(`Despedida enviada a ${participantJid} en ${groupId}`);
  } catch (err) {
    logger.error('Error enviando despedida:', err.message);
  }
}

export async function handleParticipantEvent(groupId, participants, action) {
  if (!groupId || !participants || participants.length === 0) return;

  for (const participant of participants) {
    if (action === 'add') {
      await sendWelcomeMessage(groupId, participant);
    } else if (action === 'remove' || action === 'leave') {
      await sendGoodbyeMessage(groupId, participant);
    }
  }
}

export default {
  name: 'welcome',
  description: 'Bienvenida y despedida personalizada',
  commands: ['welcome', 'goodbye', 'setwelcome', 'setgoodbye', 'welcomestatus'],
  aliases: ['bienvenida', 'despedida', 'bwelcome', 'bgoodbye'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    const subCommand = ctx.args[0]?.toLowerCase() || '';

    if (ctx.command === 'welcome' || ctx.command === 'bienvenida') {
      await handleWelcomeCommand(ctx, subCommand);
    } else if (ctx.command === 'goodbye' || ctx.command === 'despedida') {
      await handleGoodbyeCommand(ctx, subCommand);
    } else if (ctx.command === 'setwelcome' || ctx.command === 'bwelcome') {
      await handleSetWelcome(ctx);
    } else if (ctx.command === 'setgoodbye' || ctx.command === 'bgoodbye') {
      await handleSetGoodbye(ctx);
    } else if (ctx.command === 'welcomestatus') {
      await handleWelcomeStatus(ctx);
    }
  }
};

async function handleWelcomeCommand(ctx, subCommand) {
  if (!ctx.isAdmin) {
    await ctx.reply('❌ Necesitas ser administrador para configurar la bienvenida.');
    return;
  }

  if (subCommand === 'on') {
    toggleWelcome(ctx.chat, true);
    await ctx.reply('✅ Bienvenida activada para este grupo.');
  } else if (subCommand === 'off') {
    toggleWelcome(ctx.chat, false);
    await ctx.reply('✅ Bienvenida desactivada para este grupo.');
  } else if (subCommand === 'test') {
    const config = getGroupWelcomeConfig(ctx.chat);
    const variables = await getGroupVariables(ctx.chat, ctx.sender);
    const preview = replaceVariables(config.welcomeMessage, variables);
    await ctx.reply(`📋 *Vista previa de bienvenida:*\n\n${preview}`);
  } else {
    await ctx.reply(
      'Uso: ' + ctx.prefix + 'welcome <on|off|test>\n' +
      'on — Activar bienvenida\n' +
      'off — Desactivar bienvenida\n' +
      'test — Ver vista previa'
    );
  }
}

async function handleGoodbyeCommand(ctx, subCommand) {
  if (!ctx.isAdmin) {
    await ctx.reply('❌ Necesitas ser administrador para configurar la despedida.');
    return;
  }

  if (subCommand === 'on') {
    toggleGoodbye(ctx.chat, true);
    await ctx.reply('✅ Despedida activada para este grupo.');
  } else if (subCommand === 'off') {
    toggleGoodbye(ctx.chat, false);
    await ctx.reply('✅ Despedida desactivada para este grupo.');
  } else if (subCommand === 'test') {
    const config = getGroupWelcomeConfig(ctx.chat);
    const variables = await getGroupVariables(ctx.chat, ctx.sender);
    const preview = replaceVariables(config.goodbyeMessage, variables);
    await ctx.reply(`📋 *Vista previa de despedida:*\n\n${preview}`);
  } else {
    await ctx.reply(
      'Uso: ' + ctx.prefix + 'goodbye <on|off|test>\n' +
      'on — Activar despedida\n' +
      'off — Desactivar despedida\n' +
      'test — Ver vista previa'
    );
  }
}

async function handleSetWelcome(ctx) {
  if (!ctx.isAdmin) {
    await ctx.reply('❌ Necesitas ser administrador para configurar el mensaje.');
    return;
  }

  const message = ctx.args.join(' ');
  if (!message) {
    await ctx.reply('❌ Proporciona un mensaje.\nUso: ' + ctx.prefix + 'setwelcome ¡Bienvenido {user} a {group}!');
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    await ctx.reply(`❌ El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`);
    return;
  }

  setWelcomeMessage(ctx.chat, message);
  await ctx.reply('✅ Mensaje de bienvenida actualizado.');
}

async function handleSetGoodbye(ctx) {
  if (!ctx.isAdmin) {
    await ctx.reply('❌ Necesitas ser administrador para configurar el mensaje.');
    return;
  }

  const message = ctx.args.join(' ');
  if (!message) {
    await ctx.reply('❌ Proporciona un mensaje.\nUso: ' + ctx.prefix + 'setgoodbye Adiós {user}, gracias por estar en {group}.');
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    await ctx.reply(`❌ El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`);
    return;
  }

  setGoodbyeMessage(ctx.chat, message);
  await ctx.reply('✅ Mensaje de despedida actualizado.');
}

async function handleWelcomeStatus(ctx) {
  const config = getGroupWelcomeConfig(ctx.chat);

  let status = `📋 *Configuración de bienvenida*\n`;
  status += `━━━━━━━━━━━━━━━━━━\n`;
  status += `Bienvenida: ${config.welcomeEnabled ? '✅ Activada' : '❌ Desactivada'}\n`;
  status += `Despedida: ${config.goodbyeEnabled ? '✅ Activada' : '❌ Desactivada'}\n\n`;
  status += `Mensaje de bienvenida:\n${config.welcomeMessage}\n\n`;
  status += `Mensaje de despedida:\n${config.goodbyeMessage}`;

  await ctx.reply(status);
}

export { replaceVariables, getGroupVariables, sendWelcomeMessage, sendGoodbyeMessage };
