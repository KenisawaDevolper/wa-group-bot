import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import logger from '../src/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'antilink.json');

let cache = null;

export function loadAntilinkConfig() {
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
    logger.error('Error cargando config antilink:', err.message);
    return {};
  }
}

export function saveAntilinkConfig(data) {
  try {
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
    cache = data;
    return true;
  } catch (err) {
    logger.error('Error guardando config antilink:', err.message);
    return false;
  }
}

export function getGroupAntilinkConfig(groupId) {
  const config = loadAntilinkConfig();
  return config[groupId] || {
    antilinkEnabled: false,
    antilinkAction: 'delete',
    allowedDomains: [],
    blockedDomains: []
  };
}

export function setGroupAntilinkConfig(groupId, settings) {
  const config = loadAntilinkConfig();
  const current = config[groupId] || {
    antilinkEnabled: false,
    antilinkAction: 'delete',
    allowedDomains: [],
    blockedDomains: []
  };

  config[groupId] = { ...current, ...settings };
  return saveAntilinkConfig(config);
}

export function toggleAntilink(groupId, enabled) {
  return setGroupAntilinkConfig(groupId, { antilinkEnabled: enabled });
}

export function setAntilinkAction(groupId, action) {
  return setGroupAntilinkConfig(groupId, { antilinkAction: action });
}

export function addAllowedDomain(groupId, domain) {
  const config = getGroupAntilinkConfig(groupId);
  if (!config.allowedDomains.includes(domain)) {
    config.allowedDomains.push(domain);
    return setGroupAntilinkConfig(groupId, { allowedDomains: config.allowedDomains });
  }
  return false;
}

export function removeAllowedDomain(groupId, domain) {
  const config = getGroupAntilinkConfig(groupId);
  const idx = config.allowedDomains.indexOf(domain);
  if (idx !== -1) {
    config.allowedDomains.splice(idx, 1);
    return setGroupAntilinkConfig(groupId, { allowedDomains: config.allowedDomains });
  }
  return false;
}

export function addBlockedDomain(groupId, domain) {
  const config = getGroupAntilinkConfig(groupId);
  if (!config.blockedDomains.includes(domain)) {
    config.blockedDomains.push(domain);
    return setGroupAntilinkConfig(groupId, { blockedDomains: config.blockedDomains });
  }
  return false;
}

export function removeBlockedDomain(groupId, domain) {
  const config = getGroupAntilinkConfig(groupId);
  const idx = config.blockedDomains.indexOf(domain);
  if (idx !== -1) {
    config.blockedDomains.splice(idx, 1);
    return setGroupAntilinkConfig(groupId, { blockedDomains: config.blockedDomains });
  }
  return false;
}

export function reloadAntilinkConfig() {
  cache = null;
  return loadAntilinkConfig();
}

export default {
  loadAntilinkConfig,
  saveAntilinkConfig,
  getGroupAntilinkConfig,
  setGroupAntilinkConfig,
  toggleAntilink,
  setAntilinkAction,
  addAllowedDomain,
  removeAllowedDomain,
  addBlockedDomain,
  removeBlockedDomain,
  reloadAntilinkConfig
};
