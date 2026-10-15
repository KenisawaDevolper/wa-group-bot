import { addWarning, getMentions } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'warn',
  description: 'Advierte a un participante',
  commands: ['warn'],
  aliases: ['advertir', 'advertencia'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    if (!ctx.isAdmin) {
      await ctx.reply('❌ Necesitas ser administrador para advertir.');
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
      await ctx.reply('❌ No puedes advertirte a ti mismo.');
      return;
    }

    if (targetJid === ctx.botJid) {
      await ctx.reply('❌ No puedo advertirme a mí mismo.');
      return;
    }

    const reason = ctx.args.slice(targetJid && ctx.args[0]?.includes(targetJid.split('@')[0]) ? 1 : 0).join(' ') || 'Sin motivo';

    try {
      const total = addWarning(ctx.chat, targetJid, reason, ctx.sender);
      await ctx.reply(
        `⚠️ Usuario @${targetJid.split('@')[0]} advertido.\n` +
        `Motivo: ${reason}\n` +
        `Total de advertencias: ${total}`,
        { mentions: [targetJid] }
      );
      logger.info(`Warn: ${targetJid} por ${ctx.sender} en ${ctx.chat} — motivo: ${reason}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en warn: ${err.message}`);
    }
  }
};
