import { isGroupAdmin, isGroupOwner } from '../../src/permissions.js';
import { kickParticipant, getMentions } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'kick',
  description: 'Expulsa a un participante del grupo',
  commands: ['kick'],
  aliases: ['expulsar', 'echar'],
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
      await ctx.reply('❌ El bot necesita ser administrador para expulsar participantes.');
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
      await ctx.reply('❌ No puedes expulsarte a ti mismo.');
      return;
    }

    if (targetJid === ctx.botJid) {
      await ctx.reply('❌ No puedo expulsarme a mí mismo.');
      return;
    }

    try {
      await kickParticipant(ctx.chat, targetJid);
      await ctx.reply(`✅ Usuario @${targetJid.split('@')[0]} expulsado del grupo.`, {
        mentions: [targetJid]
      });
      logger.info(`Kick: ${targetJid} por ${ctx.sender} en ${ctx.chat}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en kick: ${err.message}`);
    }
  }
};
