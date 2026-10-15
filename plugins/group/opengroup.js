import { setGroupAnnounce } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'opengroup',
  description: 'Permite que todos los participantes escriban',
  commands: ['opengroup'],
  aliases: ['abrirgrupo', 'grupoabierto'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    if (!ctx.isAdmin) {
      await ctx.reply('❌ Necesitas ser administrador para abrir el grupo.');
      return;
    }

    if (!ctx.isBotAdmin) {
      await ctx.reply('❌ El bot necesita ser administrador para esta acción.');
      return;
    }

    try {
      await setGroupAnnounce(ctx.chat, false);
      await ctx.reply('🔓 Grupo abierto. Todos los participantes pueden enviar mensajes.');
      logger.info(`OpenGroup: ${ctx.chat} por ${ctx.sender}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en opengroup: ${err.message}`);
    }
  }
};
