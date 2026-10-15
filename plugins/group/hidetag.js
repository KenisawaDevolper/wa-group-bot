import { tagAllParticipants } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'hidetag',
  description: 'Menciona a todos sin mostrar lista de menciones',
  commands: ['hidetag'],
  aliases: ['ht', 'taghidden'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    if (!ctx.isAdmin) {
      await ctx.reply('❌ Necesitas ser administrador para usar este comando.');
      return;
    }

    const messageText = ctx.args.join(' ') || '📢 Atención';

    try {
      const count = await tagAllParticipants(ctx.chat, messageText, true);
      logger.info(`Hidetag: ${count} participantes en ${ctx.chat} por ${ctx.sender}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en hidetag: ${err.message}`);
    }
  }
};
