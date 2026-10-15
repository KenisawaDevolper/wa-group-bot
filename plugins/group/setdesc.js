import { setGroupDescription } from '../../src/groupManager.js';
import logger from '../../src/logger.js';

export default {
  name: 'setdesc',
  description: 'Cambia la descripción del grupo',
  commands: ['setdesc'],
  aliases: ['descripcion', 'cambiardescripcion'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    if (!ctx.isAdmin) {
      await ctx.reply('❌ Necesitas ser administrador para cambiar la descripción.');
      return;
    }

    if (!ctx.isBotAdmin) {
      await ctx.reply('❌ El bot necesita ser administrador para esta acción.');
      return;
    }

    const newDesc = ctx.args.join(' ');
    if (!newDesc) {
      await ctx.reply('❌ Proporciona una nueva descripción.\nUso: ' + ctx.prefix + 'setdesc Nueva descripción');
      return;
    }

    try {
      await setGroupDescription(ctx.chat, newDesc);
      await ctx.reply('✅ Descripción del grupo actualizada.');
      logger.info(`SetDesc: ${ctx.chat} por ${ctx.sender}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
      logger.error(`Error en setdesc: ${err.message}`);
    }
  }
};
