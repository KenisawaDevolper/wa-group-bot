import { connectBot, disconnectBot } from './src/connection.js';
import { handleMessage } from './src/handler.js';
import { loadPlugins } from './src/pluginManager.js';
import { loadConfig } from './src/config.js';
import logger from './src/logger.js';

async function main() {
  logger.info('=== Iniciando WA Group Bot ===');

  const config = loadConfig();
  logger.info(`Configuración cargada — prefijo: "${config.prefix}"`);

  logger.info('Cargando plugins...');
  const pluginResult = await loadPlugins();
  logger.info(`Plugins: ${pluginResult.loaded} cargados, ${pluginResult.failed} fallidos`);

  try {
    await connectBot(handleMessage);
    logger.info('Bot conectado y listo para recibir mensajes');
  } catch (err) {
    logger.error('Error fatal conectando:', err.message);
    process.exit(1);
  }

  process.on('SIGINT', async () => {
    logger.info('Señal SIGINT recibida, cerrando...');
    await disconnectBot();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Señal SIGTERM recibida, cerrando...');
    await disconnectBot();
    process.exit(0);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Promesa no manejada:', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Excepción no capturada:', err.message);
  });
}

main();
