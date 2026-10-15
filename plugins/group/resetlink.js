import { resetGroupInviteLink } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'resetlink',
  description: 'Restablece el enlace de invitación del grupo',
  commands: ['resetlink'],
  aliases: ['resetearlink', 'nuevolink'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    if (!ctx.isAdmin) {
      await ctx.reply('❌ Necesitas ser administrador para restablecer el enlace.');
      return;
    }

    if (!ctx.isBotAdmin) {
      await ctx.reply('❌ El bot necesita ser administrador para esta acción.');
      return;
    }

    try {
      await resetGroupInviteLink(ctx.chat);
      await ctx.reply('✅ Enlace de invitación restablecido. El enlace anterior ya no es válido.');
      logger.info(`ResetLink: ${ctx.chat} por ${ctx.sender}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en resetlink: ${err.message}`);
    }
  }
};
