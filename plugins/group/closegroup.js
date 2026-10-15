import { setGroupAnnounce } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'closegroup',
  description: 'Restringe el envío de mensajes a administradores',
  commands: ['closegroup'],
  aliases: ['cerrargrupo', 'grupocerrado'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    if (!ctx.isAdmin) {
      await ctx.reply('❌ Necesitas ser administrador para cerrar el grupo.');
      return;
    }

    if (!ctx.isBotAdmin) {
      await ctx.reply('❌ El bot necesita ser administrador para esta acción.');
      return;
    }

    try {
      await setGroupAnnounce(ctx.chat, true);
      await ctx.reply('🔒 Grupo cerrado. Solo los administradores pueden enviar mensajes.');
      logger.info(`CloseGroup: ${ctx.chat} por ${ctx.sender}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en closegroup: ${err.message}`);
    }
  }
};
