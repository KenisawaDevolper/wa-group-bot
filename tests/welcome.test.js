import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  getGroupWelcomeConfig,
  setGroupWelcomeConfig,
  toggleWelcome,
  toggleGoodbye,
  setWelcomeMessage,
  setGoodbyeMessage,
  reloadWelcomeConfig,
  DEFAULT_WELCOME,
  DEFAULT_GOODBYE
} from '../database/welcomeConfig.js';
import { replaceVariables } from '../plugins/group/welcome.js';
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'database', 'welcome.json');

const TEST_GROUP = 'test-group@g.us';

function cleanConfig() {
  if (existsSync(CONFIG_PATH)) {
    unlinkSync(CONFIG_PATH);
  }
  reloadWelcomeConfig();
}

describe('Fase 4: Configuración de bienvenida por grupo', () => {
  beforeEach(() => {
    cleanConfig();
  });

  afterEach(() => {
    cleanConfig();
  });

  test('configuración por defecto está desactivada', () => {
    const config = getGroupWelcomeConfig(TEST_GROUP);
    assert.strictEqual(config.welcomeEnabled, false);
    assert.strictEqual(config.goodbyeEnabled, false);
  });

  test('activar bienvenida funciona', () => {
    toggleWelcome(TEST_GROUP, true);
    const config = getGroupWelcomeConfig(TEST_GROUP);
    assert.strictEqual(config.welcomeEnabled, true);
  });

  test('desactivar bienvenida funciona', () => {
    toggleWelcome(TEST_GROUP, true);
    toggleWelcome(TEST_GROUP, false);
    const config = getGroupWelcomeConfig(TEST_GROUP);
    assert.strictEqual(config.welcomeEnabled, false);
  });

  test('activar despedida funciona', () => {
    toggleGoodbye(TEST_GROUP, true);
    const config = getGroupWelcomeConfig(TEST_GROUP);
    assert.strictEqual(config.goodbyeEnabled, true);
  });

  test('configuración es independiente por grupo', () => {
    toggleWelcome(TEST_GROUP, true);
    toggleWelcome('other-group@g.us', false);

    const config1 = getGroupWelcomeConfig(TEST_GROUP);
    const config2 = getGroupWelcomeConfig('other-group@g.us');

    assert.strictEqual(config1.welcomeEnabled, true);
    assert.strictEqual(config2.welcomeEnabled, false);
  });

  test('setWelcomeMessage actualiza el mensaje', () => {
    const customMsg = 'Bienvenido {user} a {group}';
    setWelcomeMessage(TEST_GROUP, customMsg);
    const config = getGroupWelcomeConfig(TEST_GROUP);
    assert.strictEqual(config.welcomeMessage, customMsg);
  });

  test('setGoodbyeMessage actualiza el mensaje', () => {
    const customMsg = 'Adiós {user} de {group}';
    setGoodbyeMessage(TEST_GROUP, customMsg);
    const config = getGroupWelcomeConfig(TEST_GROUP);
    assert.strictEqual(config.goodbyeMessage, customMsg);
  });

  test('persistencia: config sobrevive recarga', () => {
    toggleWelcome(TEST_GROUP, true);
    setWelcomeMessage(TEST_GROUP, 'Mensaje personalizado');

    reloadWelcomeConfig();
    const config = getGroupWelcomeConfig(TEST_GROUP);

    assert.strictEqual(config.welcomeEnabled, true);
    assert.strictEqual(config.welcomeMessage, 'Mensaje personalizado');
  });

  test('DEFAULT_WELCOME tiene variables', () => {
    assert.ok(DEFAULT_WELCOME.includes('{user}'));
    assert.ok(DEFAULT_WELCOME.includes('{group}'));
    assert.ok(DEFAULT_WELCOME.includes('{count}'));
  });
});

describe('Fase 4: Sustitución de variables', () => {
  test('reemplaza {user} correctamente', () => {
    const result = replaceVariables('Hola {user}', { user: '1234567890' });
    assert.strictEqual(result, 'Hola 1234567890');
  });

  test('reemplaza {group} correctamente', () => {
    const result = replaceVariables('Bienvenido a {group}', { group: 'Mi Grupo' });
    assert.strictEqual(result, 'Bienvenido a Mi Grupo');
  });

  test('reemplaza {count} correctamente', () => {
    const result = replaceVariables('Somos {count}', { count: 42 });
    assert.strictEqual(result, 'Somos 42');
  });

  test('reemplaza {date} y {time}', () => {
    const result = replaceVariables('{date} {time}', {
      date: '2024-01-15',
      time: '10:30:00'
    });
    assert.strictEqual(result, '2024-01-15 10:30:00');
  });

  test('reemplaza {description}', () => {
    const result = replaceVariables('Descripción: {description}', {
      description: 'Grupo de prueba'
    });
    assert.strictEqual(result, 'Descripción: Grupo de prueba');
  });

  test('reemplaza {mention}', () => {
    const result = replaceVariables('{mention} bienvenido', {
      mention: '@1234567890'
    });
    assert.strictEqual(result, '@1234567890 bienvenido');
  });

  test('usa fallback cuando falta variable', () => {
    const result = replaceVariables('Hola {user}', {});
    assert.strictEqual(result, 'Hola usuario');
  });

  test('template con múltiples variables', () => {
    const template = 'Hola {user}, bienvenido a {group}. Somos {count} participantes.';
    const result = replaceVariables(template, {
      user: '999',
      group: 'Test',
      count: 10
    });
    assert.strictEqual(result, 'Hola 999, bienvenido a Test. Somos 10 participantes.');
  });

  test('sin variables deja texto igual', () => {
    const result = replaceVariables('Hola mundo', { user: '123' });
    assert.strictEqual(result, 'Hola mundo');
  });

  test('variables repetidas se reemplazan todas', () => {
    const result = replaceVariables('{user} vs {user}', { user: 'abc' });
    assert.strictEqual(result, 'abc vs abc');
  });
});

describe('Fase 4: Validación de plugin welcome', () => {
  test('plugin tiene estructura válida', async () => {
    const plugin = (await import('../plugins/group/welcome.js')).default;
    assert.ok(plugin.name);
    assert.ok(plugin.description);
    assert.ok(Array.isArray(plugin.commands));
    assert.ok(plugin.commands.length > 0);
    assert.ok(typeof plugin.execute === 'function');
    assert.ok(plugin.category === 'group');
  });

  test('comandos del plugin no duplican con core', async () => {
    const plugin = (await import('../plugins/group/welcome.js')).default;
    const coreCommands = ['menu', 'help', 'ping', 'info'];

    for (const cmd of plugin.commands) {
      assert.ok(!coreCommands.includes(cmd), `Comando ${cmd} duplica con core`);
    }
  });

  test('alias no duplican con comandos de grupo', async () => {
    const plugin = (await import('../plugins/group/welcome.js')).default;
    const groupCommands = ['kick', 'promote', 'demote', 'add', 'warn', 'warnings', 'resetwarn', 'tagall', 'hidetag', 'groupinfo', 'closegroup', 'opengroup', 'setname', 'setdesc', 'linkgroup', 'resetlink'];

    for (const alias of plugin.aliases) {
      assert.ok(!groupCommands.includes(alias), `Alias ${alias} duplica comando de grupo`);
    }
  });

  test('handleParticipantEvent maneja datos vacíos', async () => {
    const { handleParticipantEvent } = await import('../plugins/group/welcome.js');
    await handleParticipantEvent(null, [], 'add');
    await handleParticipantEvent('group@g.us', null, 'remove');
    assert.ok(true);
  });
});
