import { tagAllParticipants } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'tagall',
  description: 'Menciona a todos los participantes del grupo',
  commands: ['tagall'],
  aliases: ['todos', 'mentionall'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    if (!ctx.isAdmin) {
      await ctx.reply('❌ Necesitas ser administrador para mencionar a todos.');
      return;
    }

    const messageText = ctx.args.join(' ');

    try {
      const count = await tagAllParticipants(ctx.chat, messageText, false);
      logger.info(`TagAll: ${count} participantes en ${ctx.chat} por ${ctx.sender}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en tagall: ${err.message}`);
    }
  }
};
