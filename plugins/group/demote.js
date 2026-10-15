import { demoteParticipant, getMentions } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'demote',
  description: 'Quita privilegios de administrador a un participante',
  commands: ['demote'],
  aliases: ['degradar', 'quitaradmin'],
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
      await ctx.reply('❌ El bot necesita ser administrador para degradar participantes.');
      return;
    }

    const mentions = getMentions(ctx.message);
    let targetJid = mentions[0] || null;

    if (!targetJid && ctx.args.length > 0) {
      targetJid = ctx.args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    }

    if (!targetJid) {
      await ctx.reply('❌ Menciona a un usuario o proporciona su número.');
      return;
    }

    if (targetJid === ctx.sender) {
      await ctx.reply('❌ No puedes degradarte a ti mismo.');
      return;
    }

    if (targetJid === ctx.botJid) {
      await ctx.reply('❌ No puedo degradar a mí mismo.');
      return;
    }

    try {
      await demoteParticipant(ctx.chat, targetJid);
      await ctx.reply(`✅ Usuario @${targetJid.split('@')[0]} degradado de administrador.`, {
        mentions: [targetJid]
      });
      logger.info(`Demote: ${targetJid} por ${ctx.sender} en ${ctx.chat}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en demote: ${err.message}`);
    }
  }
};
