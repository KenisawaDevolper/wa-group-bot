import { resetWarnings, getMentions } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'resetwarn',
  description: 'Resetea las advertencias de un participante',
  commands: ['resetwarn'],
  aliases: ['resetwarns', 'unwarn'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    if (!ctx.isAdmin) {
      await ctx.reply('❌ Necesitas ser administrador para resetear advertencias.');
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

    try {
      const result = resetWarnings(ctx.chat, targetJid);
      if (result) {
        await ctx.reply(`✅ Advertencias de @${targetJid.split('@')[0]} reseteadas.`, {
          mentions: [targetJid]
        });
        logger.info(`ResetWarn: ${targetJid} por ${ctx.sender} en ${ctx.chat}`);
      } else {
        await ctx.reply(`✅ @${targetJid.split('@')[0]} no tenía advertencias.`, {
          mentions: [targetJid]
        });
      }
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en resetwarn: ${err.message}`);
    }
  }
};
