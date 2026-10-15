import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config', 'config.json');

const DEFAULT_CONFIG = {
  prefix: '.',
  botName: 'WA Group Bot',
  owner: '',
  language: 'es',
  disabledPlugins: [],
  maxDownloadSizeMB: 50,
  downloadTimeoutSec: 60,
  aiRateLimitPerHour: 20
};

let configCache = null;

export function loadConfig() {
  if (configCache) return configCache;

  try {
    if (!existsSync(CONFIG_PATH)) {
      mkdirSync(dirname(CONFIG_PATH), { recursive: true });
      saveConfig(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }

    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    configCache = { ...DEFAULT_CONFIG, ...parsed };
    return configCache;
  } catch (err) {
    console.error('Error cargando config:', err.message);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config) {
  try {
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    configCache = config;
    return true;
  } catch (err) {
    console.error('Error guardando config:', err.message);
    return false;
  }
}

export function reloadConfig() {
  configCache = null;
  return loadConfig();
}

export function getConfigValue(key) {
  const config = loadConfig();
  return config[key];
}

export default { loadConfig, saveConfig, reloadConfig, getConfigValue };
