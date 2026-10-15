import { getWarnings, getMentions } from '../../src/groupManager.js';

export default {
  name: 'warnings',
  description: 'Muestra las advertencias de un participante',
  commands: ['warnings'],
  aliases: ['warns', 'miswarns'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    const mentions = getMentions(ctx.message);
    let targetJid = mentions[0] || ctx.sender;

    if (ctx.args.length > 0 && !mentions[0]) {
      targetJid = ctx.args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    }

    try {
      const warns = getWarnings(ctx.chat, targetJid);
      const name = targetJid.split('@')[0];
      const isSelf = targetJid === ctx.sender;

      if (warns.length === 0) {
        await ctx.reply(isSelf ? '✅ No tienes advertencias.' : `✅ @${name} no tiene advertencias.`, {
          mentions: [targetJid]
        });
        return;
      }

      let msg = `⚠️ *Advertencias de @${name}* (${warns.length} total)\n\n`;
      warns.forEach((w, i) => {
        msg += `${i + 1}. ${w.reason}\n`;
        msg += `   Fecha: ${new Date(w.date).toLocaleString()}\n`;
        msg += `   Por: ${w.admin.split('@')[0]}\n\n`;
      });

      await ctx.reply(msg, { mentions: [targetJid] });
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  }
};
