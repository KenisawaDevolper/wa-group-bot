import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { registerPlugin, unregisterPlugin, getAllCommands, isCommandRegistered, checkDuplicateCommand, validatePlugin } from '../src/pluginManager.js';
import { loadWarnings, saveWarnings, addWarning, getWarnings, resetWarnings } from '../src/groupManager.js';
import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WARNINGS_PATH = join(__dirname, '..', 'database', 'warnings.json');

const mockPlugins = [
  { name: 'kick', description: 'Expulsar', commands: ['kick'], aliases: ['expulsar'], category: 'group', execute: async () => {} },
  { name: 'promote', description: 'Promover', commands: ['promote'], aliases: ['promocionar'], category: 'group', execute: async () => {} },
  { name: 'demote', description: 'Degradar', commands: ['demote'], aliases: ['degradar'], category: 'group', execute: async () => {} },
  { name: 'add', description: 'Añadir', commands: ['add'], aliases: ['añadir'], category: 'group', execute: async () => {} },
  { name: 'warn', description: 'Advertir', commands: ['warn'], aliases: ['advertir'], category: 'group', execute: async () => {} },
  { name: 'warnings', description: 'Ver advertencias', commands: ['warnings'], aliases: ['warns'], category: 'group', execute: async () => {} },
  { name: 'resetwarn', description: 'Resetear advertencias', commands: ['resetwarn'], aliases: ['unwarn'], category: 'group', execute: async () => {} },
  { name: 'tagall', description: 'Mencionar a todos', commands: ['tagall'], aliases: ['todos'], category: 'group', execute: async () => {} },
  { name: 'hidetag', description: 'Mencionar oculto', commands: ['hidetag'], aliases: ['ht'], category: 'group', execute: async () => {} },
  { name: 'groupinfo', description: 'Info del grupo', commands: ['groupinfo'], aliases: ['ginfo'], category: 'group', execute: async () => {} },
  { name: 'closegroup', description: 'Cerrar grupo', commands: ['closegroup'], aliases: ['cerrargrupo'], category: 'group', execute: async () => {} },
  { name: 'opengroup', description: 'Abrir grupo', commands: ['opengroup'], aliases: ['abrirgrupo'], category: 'group', execute: async () => {} },
  { name: 'setname', description: 'Cambiar nombre', commands: ['setname'], aliases: ['nombregrupo'], category: 'group', execute: async () => {} },
  { name: 'setdesc', description: 'Cambiar descripción', commands: ['setdesc'], aliases: ['descripcion'], category: 'group', execute: async () => {} },
  { name: 'linkgroup', description: 'Enlace del grupo', commands: ['linkgroup'], aliases: ['link'], category: 'group', execute: async () => {} },
  { name: 'resetlink', description: 'Restablecer enlace', commands: ['resetlink'], aliases: ['resetearlink'], category: 'group', execute: async () => {} }
];

describe('Fase 3: Registro de comandos de grupo', () => {
  test('todos los 16 comandos de grupo se registran', () => {
    for (const p of mockPlugins) {
      const result = registerPlugin(p);
      assert.strictEqual(result.success, true, `Plugin ${p.name} debería registrarse: ${result.error}`);
    }

    const expected = ['kick', 'promote', 'demote', 'add', 'warn', 'warnings', 'resetwarn', 'tagall', 'hidetag', 'groupinfo', 'closegroup', 'opengroup', 'setname', 'setdesc', 'linkgroup', 'resetlink'];
    for (const cmd of expected) {
      assert.strictEqual(isCommandRegistered(cmd), true, `Comando ${cmd} debería estar registrado`);
    }

    for (const p of mockPlugins) {
      unregisterPlugin(p.name);
    }
  });

  test('aliases de grupo se registran correctamente', () => {
    for (const p of mockPlugins) {
      registerPlugin(p);
    }

    const aliasChecks = [
      { cmd: 'expulsar', expected: true },
      { cmd: 'promocionar', expected: true },
      { cmd: 'degradar', expected: true },
      { cmd: 'warns', expected: true },
      { cmd: 'cerrargrupo', expected: true },
      { cmd: 'abrirgrupo', expected: true },
      { cmd: 'link', expected: true }
    ];

    for (const { cmd, expected } of aliasChecks) {
      assert.strictEqual(isCommandRegistered(cmd), expected, `Alias ${cmd} debería estar ${expected ? 'registrado' : 'no registrado'}`);
    }

    for (const p of mockPlugins) {
      unregisterPlugin(p.name);
    }
  });

  test('no hay comandos duplicados entre plugins de grupo', () => {
    for (const p of mockPlugins) {
      registerPlugin(p);
    }

    const allCmds = getAllCommands().filter(c => c.category === 'group');
    const cmdSet = new Set();
    for (const c of allCmds) {
      assert.strictEqual(cmdSet.has(c.command), false, `Comando duplicado: ${c.command}`);
      cmdSet.add(c.command);
    }

    for (const p of mockPlugins) {
      unregisterPlugin(p.name);
    }
  });

  test('detecta intento de duplicar comando existente', () => {
    for (const p of mockPlugins) {
      registerPlugin(p);
    }

    const dup = { name: 'dupkick', description: 'dup', commands: ['kick'], aliases: [], category: 'group', execute: async () => {} };
    const result = registerPlugin(dup);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('duplicado'));

    for (const p of mockPlugins) {
      unregisterPlugin(p.name);
    }
  });

  test('detecta intento de duplicar alias existente', () => {
    for (const p of mockPlugins) {
      registerPlugin(p);
    }

    const dup = { name: 'dupalias', description: 'dup', commands: ['newcmd'], aliases: ['kick'], category: 'group', execute: async () => {} };
    const result = registerPlugin(dup);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('duplicado'));

    for (const p of mockPlugins) {
      unregisterPlugin(p.name);
    }
  });
});

describe('Fase 3: Sistema de advertencias', () => {
  const testGroup = 'test-group@g.us';
  const testUser = '1234567890@s.whatsapp.net';
  const testAdmin = '0987654321@s.whatsapp.net';

  beforeEach(() => {
    if (existsSync(WARNINGS_PATH)) {
      unlinkSync(WARNINGS_PATH);
    }
  });

  afterEach(() => {
    if (existsSync(WARNINGS_PATH)) {
      unlinkSync(WARNINGS_PATH);
    }
  });

  test('addWarning crea entrada correctamente', () => {
    const count = addWarning(testGroup, testUser, 'Spam', testAdmin);
    assert.strictEqual(count, 1);

    const warns = getWarnings(testGroup, testUser);
    assert.strictEqual(warns.length, 1);
    assert.strictEqual(warns[0].reason, 'Spam');
    assert.strictEqual(warns[0].admin, testAdmin);
    assert.ok(warns[0].date);
  });

  test('múltiples advertencias se acumulan', () => {
    addWarning(testGroup, testUser, 'Spam', testAdmin);
    addWarning(testGroup, testUser, 'Lenguaje ofensivo', testAdmin);
    addWarning(testGroup, testUser, 'Sin motivo', testAdmin);

    const warns = getWarnings(testGroup, testUser);
    assert.strictEqual(warns.length, 3);
  });

  test('advertencias se separan por grupo', () => {
    addWarning(testGroup, testUser, 'Spam', testAdmin);
    addWarning('other-group@g.us', testUser, 'Spam', testAdmin);

    const warns1 = getWarnings(testGroup, testUser);
    const warns2 = getWarnings('other-group@g.us', testUser);

    assert.strictEqual(warns1.length, 1);
    assert.strictEqual(warns2.length, 1);
  });

  test('advertencias se separan por usuario', () => {
    addWarning(testGroup, testUser, 'Spam', testAdmin);
    addWarning(testGroup, 'other@s.whatsapp.net', 'Spam', testAdmin);

    const warns1 = getWarnings(testGroup, testUser);
    const warns2 = getWarnings(testGroup, 'other@s.whatsapp.net');

    assert.strictEqual(warns1.length, 1);
    assert.strictEqual(warns2.length, 1);
  });

  test('resetWarnings borra todas las advertencias', () => {
    addWarning(testGroup, testUser, 'Spam', testAdmin);
    addWarning(testGroup, testUser, 'Flood', testAdmin);

    const result = resetWarnings(testGroup, testUser);
    assert.strictEqual(result, true);

    const warns = getWarnings(testGroup, testUser);
    assert.strictEqual(warns.length, 0);
  });

  test('resetWarnings retorna false si no hay advertencias', () => {
    const result = resetWarnings(testGroup, testUser);
    assert.strictEqual(result, false);
  });

  test('getWarnings retorna array vacío si no existe', () => {
    const warns = getWarnings('nonexistent@g.us', 'nobody@s.whatsapp.net');
    assert.strictEqual(warns.length, 0);
  });

  test('persistencia: datos sobreviven recarga', () => {
    addWarning(testGroup, testUser, 'Spam', testAdmin);

    const data = loadWarnings();
    assert.ok(data[testGroup]);
    assert.ok(data[testGroup][testUser]);
    assert.strictEqual(data[testGroup][testUser].length, 1);
  });

  test('saveWarnings y loadWarnings son consistentes', () => {
    const testData = {
      'group1@g.us': {
        'user1@s.whatsapp.net': [
          { reason: 'Test', date: new Date().toISOString(), admin: 'admin@s.whatsapp.net' }
        ]
      }
    };

    saveWarnings(testData);
    const loaded = loadWarnings();
    assert.deepStrictEqual(loaded, testData);
  });
});

describe('Fase 3: Validación de plugins de grupo', () => {
  test('plugin sin execute es rechazado', () => {
    const result = validatePlugin({ name: 'bad', description: 'test', commands: ['bad'], aliases: [], category: 'group' });
    assert.strictEqual(result.valid, false);
  });

  test('plugin con commands vacío es rechazado', () => {
    const result = validatePlugin({ name: 'bad', description: 'test', commands: [], aliases: [], category: 'group', execute: async () => {} });
    assert.strictEqual(result.valid, false);
  });

  test('plugin con aliases no-array es rechazado', () => {
    const result = validatePlugin({ name: 'bad', description: 'test', commands: ['bad'], aliases: 'notarray', category: 'group', execute: async () => {} });
    assert.strictEqual(result.valid, false);
  });
});
