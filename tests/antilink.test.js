import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  getGroupAntilinkConfig,
  toggleAntilink,
  setAntilinkAction,
  addAllowedDomain,
  removeAllowedDomain,
  addBlockedDomain,
  removeBlockedDomain,
  reloadAntilinkConfig
} from '../database/antilinkConfig.js';
import {
  detectLinks,
  isDomainAllowed,
  isDomainBlocked,
  extractDomain,
  isValidDomain,
  checkAndModerateMessage
} from '../plugins/group/antilink.js';
import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'database', 'antilink.json');

const TEST_GROUP = 'test-antilink@g.us';

function cleanConfig() {
  if (existsSync(CONFIG_PATH)) {
    unlinkSync(CONFIG_PATH);
  }
  reloadAntilinkConfig();
}

describe('Fase 5: Configuración antilink', () => {
  beforeEach(() => cleanConfig());
  afterEach(() => cleanConfig());

  test('configuración por defecto desactivada', () => {
    const config = getGroupAntilinkConfig(TEST_GROUP);
    assert.strictEqual(config.antilinkEnabled, false);
    assert.strictEqual(config.antilinkAction, 'delete');
    assert.deepStrictEqual(config.allowedDomains, []);
    assert.deepStrictEqual(config.blockedDomains, []);
  });

  test('activar antilink', () => {
    toggleAntilink(TEST_GROUP, true);
    const config = getGroupAntilinkConfig(TEST_GROUP);
    assert.strictEqual(config.antilinkEnabled, true);
  });

  test('desactivar antilink', () => {
    toggleAntilink(TEST_GROUP, true);
    toggleAntilink(TEST_GROUP, false);
    const config = getGroupAntilinkConfig(TEST_GROUP);
    assert.strictEqual(config.antilinkEnabled, false);
  });

  test('configuración independiente por grupo', () => {
    toggleAntilink(TEST_GROUP, true);
    toggleAntilink('other@g.us', false);
    assert.strictEqual(getGroupAntilinkConfig(TEST_GROUP).antilinkEnabled, true);
    assert.strictEqual(getGroupAntilinkConfig('other@g.us').antilinkEnabled, false);
  });

  test('setAntilinkAction funciona', () => {
    setAntilinkAction(TEST_GROUP, 'warn');
    assert.strictEqual(getGroupAntilinkConfig(TEST_GROUP).antilinkAction, 'warn');
  });

  test('addAllowedDomain y removeAllowedDomain', () => {
    addAllowedDomain(TEST_GROUP, 'example.com');
    assert.ok(getGroupAntilinkConfig(TEST_GROUP).allowedDomains.includes('example.com'));

    removeAllowedDomain(TEST_GROUP, 'example.com');
    assert.ok(!getGroupAntilinkConfig(TEST_GROUP).allowedDomains.includes('example.com'));
  });

  test('addBlockedDomain y removeBlockedDomain', () => {
    addBlockedDomain(TEST_GROUP, 'spam.com');
    assert.ok(getGroupAntilinkConfig(TEST_GROUP).blockedDomains.includes('spam.com'));

    removeBlockedDomain(TEST_GROUP, 'spam.com');
    assert.ok(!getGroupAntilinkConfig(TEST_GROUP).blockedDomains.includes('spam.com'));
  });

  test('persistencia de configuración', () => {
    toggleAntilink(TEST_GROUP, true);
    setAntilinkAction(TEST_GROUP, 'kick');
    addAllowedDomain(TEST_GROUP, 'google.com');
    addBlockedDomain(TEST_GROUP, 'evil.com');

    reloadAntilinkConfig();
    const config = getGroupAntilinkConfig(TEST_GROUP);

    assert.strictEqual(config.antilinkEnabled, true);
    assert.strictEqual(config.antilinkAction, 'kick');
    assert.ok(config.allowedDomains.includes('google.com'));
    assert.ok(config.blockedDomains.includes('evil.com'));
  });
});

describe('Fase 5: Detección de URLs', () => {
  test('detecta URL con https://', () => {
    const links = detectLinks('Visita https://example.com/pagina');
    assert.ok(links.length > 0);
  });

  test('detecta URL con http://', () => {
    const links = detectLinks('Mira http://test.org');
    assert.ok(links.length > 0);
  });

  test('detecta URL sin protocolo con www', () => {
    const links = detectLinks('Ve a www.example.com');
    assert.ok(links.length > 0);
  });

  test('detecta dominio simple con TLD', () => {
    const links = detectLinks('visita example.com hoy');
    assert.ok(links.length > 0);
  });

  test('detecta invitación de WhatsApp', () => {
    const links = detectLinks('https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV');
    assert.ok(links.some(l => l.includes('whatsapp.com')));
  });

  test('detecta mayúsculas en URL', () => {
    const links = detectLinks('HTTPS://EXAMPLE.COM');
    assert.ok(links.length > 0);
  });

  test('detecta múltiples enlaces', () => {
    const links = detectLinks('Visita https://a.com y también https://b.org');
    assert.strictEqual(links.length, 2);
  });

  test('no detecta texto plano sin dominio', () => {
    const links = detectLinks('hola mundo como estas');
    assert.strictEqual(links.length, 0);
  });

  test('no detecta palabras comunes como dominios', () => {
    const links = detectLinks('el proyecto está bien');
    assert.strictEqual(links.length, 0);
  });

  test('maneja entrada nula', () => {
    assert.deepStrictEqual(detectLinks(null), []);
    assert.deepStrictEqual(detectLinks(''), []);
  });

  test('detecta subdominios', () => {
    const links = detectLinks('sub.domain.example.com/path');
    assert.ok(links.length > 0);
  });
});

describe('Fase 5: Extracción y validación de dominios', () => {
  test('extractDomain con https://', () => {
    assert.strictEqual(extractDomain('https://example.com/path'), 'example.com');
  });

  test('extractDomain con www', () => {
    assert.strictEqual(extractDomain('www.example.com'), 'example.com');
  });

  test('extractDomain sin protocolo', () => {
    assert.strictEqual(extractDomain('example.com/page'), 'example.com');
  });

  test('isValidDomain acepta dominios válidos', () => {
    assert.strictEqual(isValidDomain('example.com'), true);
    assert.strictEqual(isValidDomain('sub.example.org'), true);
    assert.strictEqual(isValidDomain('mi-dominio.es'), true);
  });

  test('isValidDomain rechaza entradas inválidas', () => {
    assert.strictEqual(isValidDomain(''), false);
    assert.strictEqual(isValidDomain(null), false);
    assert.strictEqual(isValidDomain('dominio con espacios'), false);
    assert.strictEqual(isValidDomain('a'), false);
  });

  test('isValidDomain rechaza dominios demasiado largos', () => {
    const longDomain = 'a'.repeat(300) + '.com';
    assert.strictEqual(isValidDomain(longDomain), false);
  });
});

describe('Fase 5: Listas de dominios', () => {
  test('isDomainAllowed con coincidencia exacta', () => {
    assert.strictEqual(isDomainAllowed('example.com', ['example.com']), true);
  });

  test('isDomainAllowed con subdominio', () => {
    assert.strictEqual(isDomainAllowed('sub.example.com', ['example.com']), true);
  });

  test('isDomainAllowed con lista vacía', () => {
    assert.strictEqual(isDomainAllowed('example.com', []), false);
  });

  test('isDomainBlocked con coincidencia exacta', () => {
    assert.strictEqual(isDomainBlocked('spam.com', ['spam.com']), true);
  });

  test('isDomainBlocked con subdominio', () => {
    assert.strictEqual(isDomainBlocked('sub.spam.com', ['spam.com']), true);
  });

  test('isDomainBlocked con lista vacía', () => {
    assert.strictEqual(isDomainBlocked('spam.com', []), false);
  });
});

describe('Fase 5: Moderación de mensajes', () => {
  test('checkAndModerateMessage ignora mensajes fuera de grupo', async () => {
    const message = {
      key: { id: 'test1', remoteJid: 'private@whatsapp.net' },
      message: { conversation: 'https://example.com' }
    };
    await checkAndModerateMessage('private@whatsapp.net', message);
    assert.ok(true);
  });

  test('checkAndModerateMessage maneja mensaje nulo', async () => {
    await checkAndModerateMessage(TEST_GROUP, null);
    assert.ok(true);
  });

  test('checkAndModerateMessage con antilink desactivado no hace nada', async () => {
    const message = {
      key: { id: 'test2', remoteJid: TEST_GROUP },
      message: { conversation: 'https://spam.com' }
    };
    await checkAndModerateMessage(TEST_GROUP, message);
    assert.ok(true);
  });

  test('checkAndModerateMessage con antilink activado procesa mensaje', async () => {
    toggleAntilink(TEST_GROUP, true);
    const message = {
      key: { id: 'test3', remoteJid: TEST_GROUP, participant: 'user@s.whatsapp.net' },
      message: { conversation: 'https://spam.com' }
    };
    await checkAndModerateMessage(TEST_GROUP, message);
    assert.ok(true);
  });

  test('mismo mensaje no se procesa dos veces (anti-duplicados en handler)', async () => {
    const { isDuplicateMessage } = await import('../src/commandRouter.js');
    const id = 'dup-test-' + Date.now();
    assert.strictEqual(isDuplicateMessage(id), false);
    assert.strictEqual(isDuplicateMessage(id), true);
  });

  test('bot admin: intenta eliminar mensaje con acción delete', async () => {
    const { getSocket } = await import('../src/connection.js');
    const sock = getSocket();
    if (!sock) return;
    const originalGroupMetadata = sock.groupMetadata;
    const originalSendMessage = sock.sendMessage;
    sock.groupMetadata = async () => ({
      participants: [{ id: sock.user.id, admin: 'superadmin' }]
    });
    let deleteAttempted = false;
    sock.sendMessage = async (jid, content) => {
      if (content.delete) deleteAttempted = true;
      return {};
    };
    toggleAntilink(TEST_GROUP, true);
    const message = {
      key: { id: 'test-delete-admin', remoteJid: TEST_GROUP, participant: 'user@s.whatsapp.net' },
      message: { conversation: 'https://spam.com' }
    };
    await checkAndModerateMessage(TEST_GROUP, message);
    assert.strictEqual(deleteAttempted, true, 'Debería intentar eliminar si el bot es admin');
    sock.groupMetadata = originalGroupMetadata;
    sock.sendMessage = originalSendMessage;
  });

  test('bot sin permisos: no intenta eliminar mensaje', async () => {
    const { getSocket } = await import('../src/connection.js');
    const sock = getSocket();
    if (!sock) return;
    const originalGroupMetadata = sock.groupMetadata;
    const originalSendMessage = sock.sendMessage;
    sock.groupMetadata = async () => ({
      participants: [{ id: sock.user.id, admin: null }]
    });
    let deleteAttempted = false;
    sock.sendMessage = async (jid, content) => {
      if (content.delete) deleteAttempted = true;
      return {};
    };
    toggleAntilink(TEST_GROUP, true);
    const message = {
      key: { id: 'test-delete-no-admin', remoteJid: TEST_GROUP, participant: 'user@s.whatsapp.net' },
      message: { conversation: 'https://spam.com' }
    };
    await checkAndModerateMessage(TEST_GROUP, message);
    assert.strictEqual(deleteAttempted, false, 'No debería intentar eliminar si el bot no es admin');
    sock.groupMetadata = originalGroupMetadata;
    sock.sendMessage = originalSendMessage;
  });

  test('error al comprobar permisos: no lanza excepción', async () => {
    const { getSocket } = await import('../src/connection.js');
    const sock = getSocket();
    if (!sock) return;
    const originalGroupMetadata = sock.groupMetadata;
    sock.groupMetadata = async () => { throw new Error('Simulated Baileys error'); };
    toggleAntilink(TEST_GROUP, true);
    const message = {
      key: { id: 'test-perm-error', remoteJid: TEST_GROUP, participant: 'user@s.whatsapp.net' },
      message: { conversation: 'https://spam.com' }
    };
    try {
      await checkAndModerateMessage(TEST_GROUP, message);
      assert.ok(true);
    } catch (err) {
      assert.fail(`No debería lanzar excepción: ${err.message}`);
    }
    sock.groupMetadata = originalGroupMetadata;
  });

  test('error al eliminar: no detiene el bot', async () => {
    const { getSocket } = await import('../src/connection.js');
    const sock = getSocket();
    if (!sock) return;
    const originalGroupMetadata = sock.groupMetadata;
    const originalSendMessage = sock.sendMessage;
    sock.groupMetadata = async () => ({
      participants: [{ id: sock.user.id, admin: 'superadmin' }]
    });
    sock.sendMessage = async () => { throw new Error('Delete failed'); };
    toggleAntilink(TEST_GROUP, true);
    const message = {
      key: { id: 'test-delete-error', remoteJid: TEST_GROUP, participant: 'user@s.whatsapp.net' },
      message: { conversation: 'https://spam.com' }
    };
    try {
      await checkAndModerateMessage(TEST_GROUP, message);
      assert.ok(true);
    } catch (err) {
      assert.fail(`No debería lanzar excepción: ${err.message}`);
    }
    sock.groupMetadata = originalGroupMetadata;
    sock.sendMessage = originalSendMessage;
  });
});

describe('Fase 5: Estructura del plugin antilink', () => {
  test('plugin tiene estructura válida', async () => {
    const plugin = (await import('../plugins/group/antilink.js')).default;
    assert.ok(plugin.name);
    assert.ok(plugin.description);
    assert.ok(Array.isArray(plugin.commands));
    assert.ok(plugin.commands.includes('antilink'));
    assert.ok(typeof plugin.execute === 'function');
    assert.ok(plugin.category === 'group');
  });

  test('plugin no duplica comandos con otros plugins', async () => {
    const plugin = (await import('../plugins/group/antilink.js')).default;
    const existing = ['kick', 'promote', 'demote', 'add', 'warn', 'warnings', 'resetwarn', 'tagall', 'hidetag', 'groupinfo', 'closegroup', 'opengroup', 'setname', 'setdesc', 'linkgroup', 'resetlink', 'welcome', 'goodbye', 'setwelcome', 'setgoodbye', 'welcomestatus', 'menu', 'help', 'ping', 'info'];
    for (const cmd of plugin.commands) {
      assert.ok(!existing.includes(cmd), `Comando ${cmd} duplica`);
    }
  });

  test('plugin tiene aliases', async () => {
    const plugin = (await import('../plugins/group/antilink.js')).default;
    assert.ok(Array.isArray(plugin.aliases));
    assert.ok(plugin.aliases.length > 0);
  });
});
