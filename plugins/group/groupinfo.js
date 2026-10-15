import { getGroupInfo } from '../../src/groupManager.js';
import { getConnectionState } from '../../src/connection.js';

export default {
  name: 'groupinfo',
  description: 'Muestra información del grupo',
  commands: ['groupinfo'],
  aliases: ['ginfo', 'infogrupo'],
  category: 'group',

  async execute(ctx) {
    if (!ctx.isGroup) {
      await ctx.reply('❌ Este comando solo funciona en grupos.');
      return;
    }

    try {
      const info = await getGroupInfo(ctx.chat);
      const state = getConnectionState();

      let msg = `📋 *Información del Grupo*\n`;
      msg += `━━━━━━━━━━━━━━━━━━\n`;
      msg += `Nombre: ${info.name}\n`;
      msg += `ID: ${info.id}\n`;
      msg += `Descripción: ${info.description}\n`;
      msg += `Participantes: ${info.participantCount}\n`;
      msg += `Administradores: ${info.admins.length}\n`;
      msg += `Propietario: ${info.owner ? '@' + info.owner.split('@')[0] : 'Desconocido'}\n`;
      msg += `Estado del bot: ${state}\n`;
      msg += `Creación: ${info.createdAt}`;

      await ctx.reply(msg);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  }
};
