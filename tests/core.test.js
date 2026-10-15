import { test, describe } from 'node:test';
import assert from 'node:assert';
import { validatePlugin, checkDuplicateCommand, registerPlugin, unregisterPlugin, isCommandRegistered, getAllCommands, getCommandsByCategory } from '../src/pluginManager.js';
import { routeCommand, isDuplicateMessage, getProcessedCount } from '../src/commandRouter.js';
import { loadConfig, saveConfig } from '../src/config.js';

describe('PluginManager', () => {
  test('validatePlugin rechaza plugin sin nombre', () => {
    const result = validatePlugin({ description: 'test', commands: ['test'], aliases: [], category: 'test', execute: () => {} });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('nombre'));
  });

  test('validatePlugin rechaza plugin sin commands', () => {
    const result = validatePlugin({ name: 'test', description: 'test', commands: [], aliases: [], category: 'test', execute: () => {} });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('commands'));
  });

  test('validatePlugin rechaza plugin sin execute', () => {
    const result = validatePlugin({ name: 'test', description: 'test', commands: ['test'], aliases: [], category: 'test' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('execute'));
  });

  test('validatePlugin acepta plugin válido', () => {
    const result = validatePlugin({ name: 'test', description: 'test', commands: ['test'], aliases: [], category: 'test', execute: async () => {} });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.error, null);
  });

  test('checkDuplicateCommand detecta duplicados entre plugins', () => {
    const p1 = { name: 'p1', description: 'test', commands: ['cmd1'], aliases: [], category: 'test', execute: async () => {} };
    const p2 = { name: 'p2', description: 'test', commands: ['cmd1'], aliases: [], category: 'test', execute: async () => {} };

    registerPlugin(p1);
    const dup = checkDuplicateCommand('cmd1', 'p2');
    assert.strictEqual(dup.duplicate, true);
    assert.strictEqual(dup.plugin, 'p1');

    unregisterPlugin('p1');
  });

  test('checkDuplicateCommand detecta duplicados por alias', () => {
    const p1 = { name: 'p1', description: 'test', commands: ['cmd1'], aliases: ['c1'], category: 'test', execute: async () => {} };
    const p2 = { name: 'p2', description: 'test', commands: ['c1'], aliases: [], category: 'test', execute: async () => {} };

    registerPlugin(p1);
    const dup = checkDuplicateCommand('c1', 'p2');
    assert.strictEqual(dup.duplicate, true);

    unregisterPlugin('p1');
  });

  test('isCommandRegistered funciona correctamente', () => {
    const p = { name: 'testreg', description: 'test', commands: ['mycmd'], aliases: ['mc'], category: 'test', execute: async () => {} };
    registerPlugin(p);

    assert.strictEqual(isCommandRegistered('mycmd'), true);
    assert.strictEqual(isCommandRegistered('mc'), true);
    assert.strictEqual(isCommandRegistered('nonexistent'), false);

    unregisterPlugin('testreg');
  });

  test('getAllCommands retorna comandos registrados', () => {
    const p = { name: 'testall', description: 'test desc', commands: ['cmdA', 'cmdB'], aliases: ['a'], category: 'tools', execute: async () => {} };
    registerPlugin(p);

    const cmds = getAllCommands();
    const found = cmds.filter(c => c.plugin === 'testall');
    assert.strictEqual(found.length, 2);
    assert.ok(found.some(c => c.command === 'cmdA'));
    assert.ok(found.some(c => c.command === 'cmdB'));

    unregisterPlugin('testall');
  });

  test('getCommandsByCategory agrupa correctamente', () => {
    const p = { name: 'testcat', description: 'test', commands: ['catcmd'], aliases: [], category: 'mycat', execute: async () => {} };
    registerPlugin(p);

    const cats = getCommandsByCategory();
    assert.ok(cats['mycat']);
    assert.strictEqual(cats['mycat'].length, 1);

    unregisterPlugin('testcat');
  });
});

describe('CommandRouter', () => {
  test('routeCommand maneja comandos vacíos', () => {
    const result = routeCommand('', {}, []);
    assert.strictEqual(result.handled, false);
    assert.strictEqual(result.reason, 'empty_command');
  });

  test('routeCommand retorna not_found para comandos desconocidos', () => {
    const result = routeCommand('nonexistent123', {}, []);
    assert.strictEqual(result.handled, false);
    assert.strictEqual(result.reason, 'not_found');
  });

  test('isDuplicateMessage detecta duplicados', () => {
    const id = 'test-dup-' + Date.now();
    assert.strictEqual(isDuplicateMessage(id), false);
    assert.strictEqual(isDuplicateMessage(id), true);
  });

  test('isDuplicateMessage maneja IDs nulos', () => {
    assert.strictEqual(isDuplicateMessage(null), false);
  });

  test('routeCommand delega a plugins', async () => {
    const p = { name: 'testroute', description: 'test', commands: ['plugcmd'], aliases: [], category: 'test', execute: async (ctx) => { ctx.executed = true; } };
    registerPlugin(p);

    let executed = false;
    const ctx = {
      reply: async () => {},
      sendMessage: async () => {}
    };

    const result = routeCommand('plugcmd', ctx, []);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.type, 'plugin');

    await result.execute(result.ctx);
    executed = true;
    assert.strictEqual(executed, true);

    unregisterPlugin('testroute');
  });
});

describe('Config', () => {
  test('loadConfig retorna defaults', () => {
    const config = loadConfig();
    assert.ok(config);
    assert.ok(config.prefix);
    assert.ok(config.botName);
  });

  test('saveConfig y loadConfig funcionan', () => {
    const original = loadConfig();
    const modified = { ...original, prefix: '#' };
    saveConfig(modified);
    const loaded = loadConfig();
    assert.strictEqual(loaded.prefix, '#');
    saveConfig(original);
  });
});
