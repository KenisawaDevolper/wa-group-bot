import { setGroupName } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'setname',
  description: 'Cambia el nombre del grupo',
  commands: ['setname'],
  aliases: ['nombregrupo', 'cambiarnombre'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    if (!ctx.isAdmin) {
      await ctx.reply('❌ Necesitas ser administrador para cambiar el nombre.');
      return;
    }

    if (!ctx.isBotAdmin) {
      await ctx.reply('❌ El bot necesita ser administrador para esta acción.');
      return;
    }

    const newName = ctx.args.join(' ');
    if (!newName) {
      await ctx.reply('❌ Proporciona un nuevo nombre.\nUso: ' + ctx.prefix + 'setname Nuevo Nombre');
      return;
    }

    if (newName.length > 25) {
      await ctx.reply('❌ El nombre no puede superar 25 caracteres.');
      return;
    }

    try {
      await setGroupName(ctx.chat, newName);
      await ctx.reply(`✅ Nombre del grupo cambiado a: *${newName}*`);
      logger.info(`SetName: "${newName}" en ${ctx.chat} por ${ctx.sender}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en setname: ${err.message}`);
    }
  }
};
