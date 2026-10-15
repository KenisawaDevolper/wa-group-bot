import logger from '../src/logger.js';
import { loadConfig } from '../src/config.js';
import { getAllCommands, getCommandsByCategory } from '../src/pluginManager.js';
import { getConnectionState } from '../src/connection.js';

const startTime = Date.now();

export function executeCoreCommand(command, ctx, args) {
  switch (command) {
    case 'menu':
    case 'help':
      return { handled: true, execute: () => sendMenu(ctx) };

    case 'ping':
      return { handled: true, execute: () => handlePing(ctx) };

    case 'info':
      return { handled: true, execute: () => handleInfo(ctx) };

    default:
      return { handled: false };
  }
}

async function sendMenu(ctx) {
  const config = loadConfig();
  const categories = getCommandsByCategory();

  let menuText = `🤖 *${config.botName}*\n`;
  menuText += `━━━━━━━━━━━━━━━━━━\n\n`;

  const categoryOrder = ['group', 'tools', 'downloads', 'ai', 'general'];
  const categoryEmojis = {
    group: '👥',
    tools: '🛠️',
    downloads: '📥',
    ai: '🤖',
    general: '📋'
  };

  for (const cat of categoryOrder) {
    if (!categories[cat]) continue;
    menuText += `${categoryEmojis[cat] || '📋'} *${cat.toUpperCase()}*\n`;
    for (const cmd of categories[cat]) {
      menuText += `  ${ctx.prefix}${cmd.command} — ${cmd.description}\n`;
    }
    menuText += '\n';
  }

  const otherCats = Object.keys(categories).filter(c => !categoryOrder.includes(c));
  for (const cat of otherCats) {
    menuText += `${categoryEmojis[cat] || '📋'} *${cat.toUpperCase()}*\n`;
    for (const cmd of categories[cat]) {
      menuText += `  ${ctx.prefix}${cmd.command} — ${cmd.description}\n`;
    }
    menuText += '\n';
  }

  menuText += `━━━━━━━━━━━━━━━━━━\n`;
  menuText += `Usa ${ctx.prefix}comando para ejecutar`;

  await ctx.reply(menuText);
}

async function handlePing(ctx) {
  const pong = Date.now();
  await ctx.reply(`🏓 ¡Pong! Latencia: ${pong - startTime}ms`);
}

async function handleInfo(ctx) {
  const config = loadConfig();
  const state = getConnectionState();
  const uptime = formatUptime(Date.now() - startTime);

  let info = `ℹ️ *Información del Bot*\n`;
  info += `━━━━━━━━━━━━━━━━━━\n`;
  info += `Nombre: ${config.botName}\n`;
  info += `Estado: ${state}\n`;
  info += `Tiempo activo: ${uptime}\n`;
  info += `Prefijo: ${config.prefix}\n`;
  info += `Comandos registrados: ${getAllCommands().length}\n`;

  await ctx.reply(info);
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default { executeCoreCommand };
