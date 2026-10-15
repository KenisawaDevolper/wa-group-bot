import { addParticipant } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'add',
  description: 'Añade un participante al grupo',
  commands: ['add'],
  aliases: ['añadir', 'agregar', 'invitar'],
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

    if (!ctx.isBotAdmin) {
      await ctx.reply('❌ El bot necesita ser administrador para añadir participantes.');
      return;
    }

    if (ctx.args.length === 0) {
      await ctx.reply('❌ Proporciona un número de teléfono.\nUso: ' + ctx.prefix + 'add 1234567890');
      return;
    }

    const phone = ctx.args[0].replace(/[^0-9]/g, '');
    if (phone.length < 8) {
      await ctx.reply('❌ Número de teléfono no válido.');
      return;
    }

    try {
      await addParticipant(ctx.chat, phone);
      await ctx.reply(`✅ Invitación enviada a +${phone}.`);
      logger.info(`Add: +${phone} por ${ctx.sender} en ${ctx.chat}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en add: ${err.message}`);
    }
  }
};
