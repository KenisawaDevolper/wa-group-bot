import { readdirSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import logger from './logger.js';
import { loadConfig, saveConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(__dirname, '..', 'plugins');

const registeredPlugins = new Map();
const registeredCommands = new Map();
const registeredAliases = new Map();

export function validatePlugin(plugin) {
  if (!plugin || typeof plugin !== 'object') {
    return { valid: false, error: 'Plugin no es un objeto válido' };
  }

  if (!plugin.name || typeof plugin.name !== 'string') {
    return { valid: false, error: 'Plugin debe tener un nombre (string)' };
  }

  if (!plugin.description || typeof plugin.description !== 'string') {
    return { valid: false, error: `Plugin "${plugin.name}" debe tener descripción` };
  }

  if (!Array.isArray(plugin.commands) || plugin.commands.length === 0) {
    return { valid: false, error: `Plugin "${plugin.name}" debe definir commands (array no vacío)` };
  }

  if (!Array.isArray(plugin.aliases)) {
    return { valid: false, error: `Plugin "${plugin.name}" debe definir aliases (array)` };
  }

  if (!plugin.category || typeof plugin.category !== 'string') {
    return { valid: false, error: `Plugin "${plugin.name}" debe definir category` };
  }

  if (typeof plugin.execute !== 'function') {
    return { valid: false, error: `Plugin "${plugin.name}" debe tener función execute` };
  }

  return { valid: true, error: null };
}

export function checkDuplicateCommand(command, excludePlugin = null) {
  for (const [name, plugin] of registeredPlugins) {
    if (name === excludePlugin) continue;
    if (plugin.commands?.includes(command)) {
      return { duplicate: true, plugin: name };
    }
    if (plugin.aliases?.includes(command)) {
      return { duplicate: true, plugin: name, via: 'alias' };
    }
  }

  if (registeredCommands.has(command)) {
    return { duplicate: true, plugin: registeredCommands.get(command) };
  }

  if (registeredAliases.has(command)) {
    return { duplicate: true, plugin: 'core', via: 'alias' };
  }

  return { duplicate: false, plugin: null };
}

export function registerPlugin(plugin) {
  const validation = validatePlugin(plugin);
  if (!validation.valid) {
    logger.error(`Plugin inválido: ${validation.error}`);
    return { success: false, error: validation.error };
  }

  const disabledPlugins = loadConfig().disabledPlugins || [];
  if (disabledPlugins.includes(plugin.name)) {
    logger.info(`Plugin "${plugin.name}" está desactivado en config`);
    return { success: false, error: 'Plugin desactivado en configuración' };
  }

  for (const cmd of plugin.commands) {
    const dup = checkDuplicateCommand(cmd, plugin.name);
    if (dup.duplicate) {
      const via = dup.via ? ` (vía alias de "${dup.plugin}")` : ` (registrado por "${dup.plugin}")`;
      logger.error(`Comando duplicado: "${cmd}" ya existe${via}`);
      return { success: false, error: `Comando duplicado: ${cmd}` };
    }
  }

  for (const alias of plugin.aliases) {
    const dup = checkDuplicateCommand(alias, plugin.name);
    if (dup.duplicate) {
      const via = dup.via ? ` (vía alias de "${dup.plugin}")` : ` (registrado por "${dup.plugin}")`;
      logger.error(`Alias duplicado: "${alias}" ya existe${via}`);
      return { success: false, error: `Alias duplicado: ${alias}` };
    }
  }

  registeredPlugins.set(plugin.name, plugin);

  for (const cmd of plugin.commands) {
    registeredCommands.set(cmd, plugin.name);
  }
  for (const alias of plugin.aliases) {
    registeredAliases.set(alias, plugin.name);
  }

  logger.info(`Plugin registrado: ${plugin.name} [${plugin.category}] — comandos: ${plugin.commands.join(', ')}`);
  return { success: true, error: null };
}

export function unregisterPlugin(name) {
  const plugin = registeredPlugins.get(name);
  if (!plugin) return false;

  for (const cmd of plugin.commands || []) {
    registeredCommands.delete(cmd);
  }
  for (const alias of plugin.aliases || []) {
    registeredAliases.delete(alias);
  }

  registeredPlugins.delete(name);
  logger.info(`Plugin desregistrado: ${name}`);
  return true;
}

export function getPluginByCommand(command) {
  const direct = registeredCommands.get(command);
  if (direct) return registeredPlugins.get(direct) || null;

  const viaAlias = registeredAliases.get(command);
  if (viaAlias) return registeredPlugins.get(viaAlias) || null;

  return null;
}

export function getCommandOwner(command) {
  if (registeredCommands.has(command)) return registeredCommands.get(command);
  if (registeredAliases.has(command)) return registeredAliases.get(command);
  return null;
}

export function isCommandRegistered(command) {
  return registeredCommands.has(command) || registeredAliases.has(command);
}

export function getAllPlugins() {
  return Array.from(registeredPlugins.values());
}

export function getAllCommands() {
  const result = [];
  for (const [name, plugin] of registeredPlugins) {
    for (const cmd of plugin.commands) {
      result.push({
        command: cmd,
        plugin: name,
        description: plugin.description,
        category: plugin.category,
        aliases: plugin.aliases || []
      });
    }
  }
  return result;
}

export function getCommandsByCategory() {
  const categories = {};
  for (const cmd of getAllCommands()) {
    if (!categories[cmd.category]) categories[cmd.category] = [];
    categories[cmd.category].push(cmd);
  }
  return categories;
}

export async function loadPlugins() {
  registeredPlugins.clear();
  registeredCommands.clear();
  registeredAliases.clear();

  if (!existsSync(PLUGINS_DIR)) {
    mkdirSync(PLUGINS_DIR, { recursive: true });
    logger.warn(`Directorio de plugins no existía, creado en: ${PLUGINS_DIR}`);
    return { loaded: 0, failed: 0, plugins: [] };
  }

  const categories = readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let loaded = 0;
  let failed = 0;
  const pluginNames = [];

  for (const category of categories) {
    const categoryPath = join(PLUGINS_DIR, category);
    const files = readdirSync(categoryPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const filePath = join(categoryPath, file);
      try {
        const module = await import(pathToFileURL(filePath).href);
        const plugin = module.default || module;

        if (registerPlugin(plugin)) {
          loaded++;
          pluginNames.push(plugin.name);
        } else {
          failed++;
        }
      } catch (err) {
        logger.error(`Error cargando plugin ${filePath}: ${err.message}`);
        failed++;
      }
    }
  }

  logger.info(`Carga de plugins completada: ${loaded} cargados, ${failed} fallidos`);
  return { loaded, failed, plugins: pluginNames };
}

export function enablePlugin(name) {
  const config = loadConfig();
  const disabled = config.disabledPlugins || [];
  const idx = disabled.indexOf(name);
  if (idx !== -1) {
    disabled.splice(idx, 1);
    config.disabledPlugins = disabled;
    saveConfig(config);
    logger.info(`Plugin "${name}" activado en config`);
  }
}

export function disablePlugin(name) {
  const config = loadConfig();
  const disabled = config.disabledPlugins || [];
  if (!disabled.includes(name)) {
    disabled.push(name);
    config.disabledPlugins = disabled;
    saveConfig(config);
    logger.info(`Plugin "${name}" desactivado en config`);
  }
  unregisterPlugin(name);
}

export default {
  validatePlugin,
  checkDuplicateCommand,
  registerPlugin,
  unregisterPlugin,
  getPluginByCommand,
  getCommandOwner,
  isCommandRegistered,
  getAllPlugins,
  getAllCommands,
  getCommandsByCategory,
  loadPlugins,
  enablePlugin,
  disablePlugin
};
