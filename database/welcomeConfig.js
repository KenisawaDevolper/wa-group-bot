import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import logger from '../src/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'welcome.json');

const DEFAULT_WELCOME = '¡Bienvenido/a, {user}!\n\nTe damos la bienvenida a {group}.\n\nActualmente somos {count} participantes.';
const DEFAULT_GOODBYE = 'Adiós, {user}.\n\nGracias por haber formado parte de {group}.';

let cache = null;

export function loadWelcomeConfig() {
  if (cache) return cache;

  try {
    if (!existsSync(CONFIG_PATH)) {
      mkdirSync(dirname(CONFIG_PATH), { recursive: true });
      writeFileSync(CONFIG_PATH, '{}', 'utf-8');
      cache = {};
      return cache;
    }

    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    cache = JSON.parse(raw);
    return cache;
  } catch (err) {
    logger.error('Error cargando config de bienvenida:', err.message);
    return {};
  }
}

export function saveWelcomeConfig(data) {
  try {
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
    cache = data;
    return true;
  } catch (err) {
    logger.error('Error guardando config de bienvenida:', err.message);
    return false;
  }
}

export function getGroupWelcomeConfig(groupId) {
  const config = loadWelcomeConfig();
  return config[groupId] || {
    welcomeEnabled: false,
    goodbyeEnabled: false,
    welcomeMessage: DEFAULT_WELCOME,
    goodbyeMessage: DEFAULT_GOODBYE
  };
}

export function setGroupWelcomeConfig(groupId, settings) {
  const config = loadWelcomeConfig();
  const current = config[groupId] || {
    welcomeEnabled: false,
    goodbyeEnabled: false,
    welcomeMessage: DEFAULT_WELCOME,
    goodbyeMessage: DEFAULT_GOODBYE
  };

  config[groupId] = { ...current, ...settings };
  return saveWelcomeConfig(config);
}

export function toggleWelcome(groupId, enabled) {
  return setGroupWelcomeConfig(groupId, { welcomeEnabled: enabled });
}

export function toggleGoodbye(groupId, enabled) {
  return setGroupWelcomeConfig(groupId, { goodbyeEnabled: enabled });
}

export function setWelcomeMessage(groupId, message) {
  return setGroupWelcomeConfig(groupId, { welcomeMessage: message });
}

export function setGoodbyeMessage(groupId, message) {
  return setGroupWelcomeConfig(groupId, { goodbyeMessage: message });
}

export function reloadWelcomeConfig() {
  cache = null;
  return loadWelcomeConfig();
}

export { DEFAULT_WELCOME, DEFAULT_GOODBYE };

export default {
  loadWelcomeConfig,
  saveWelcomeConfig,
  getGroupWelcomeConfig,
  setGroupWelcomeConfig,
  toggleWelcome,
  toggleGoodbye,
  setWelcomeMessage,
  setGoodbyeMessage,
  reloadWelcomeConfig,
  DEFAULT_WELCOME,
  DEFAULT_GOODBYE
};
