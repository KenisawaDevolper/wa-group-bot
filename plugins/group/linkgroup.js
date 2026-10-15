import { getGroupInviteLink } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'linkgroup',
  description: 'Obtiene el enlace de invitación del grupo',
  commands: ['linkgroup'],
  aliases: ['link', 'enlace', 'invitacion'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    if (!ctx.isAdmin) {
      await ctx.reply('❌ Necesitas ser administrador para obtener el enlace.');
      return;
    }

    try {
      const link = await getGroupInviteLink(ctx.chat);
      await ctx.reply(`🔗 Enlace de invitación del grupo:\n\n${link}`);
      logger.info(`LinkGroup: ${ctx.chat} por ${ctx.sender}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en linkgroup: ${err.message}`);
    }
  }
};
