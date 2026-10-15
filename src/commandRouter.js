import logger from './logger.js';
import { isCommandRegistered, getPluginByCommand } from './pluginManager.js';
import { executeCoreCommand } from '../commands/core.js';

const processedMessages = new Set();
const MAX_PROCESSED = 500;

export function isDuplicateMessage(messageId) {
  if (!messageId) return false;
  if (processedMessages.has(messageId)) return true;

  processedMessages.add(messageId);
  if (processedMessages.size > MAX_PROCESSED) {
    const first = processedMessages.values().next().value;
    processedMessages.delete(first);
  }
  return false;
}

export function routeCommand(command, ctx, args) {
  if (!command) {
    return { handled: false, reason: 'empty_command' };
  }

  const coreResult = executeCoreCommand(command, ctx, args);
  if (coreResult.handled) {
    return coreResult;
  }

  if (isCommandRegistered(command)) {
    const plugin = getPluginByCommand(command);
    if (plugin) {
      return { handled: true, type: 'plugin', plugin: plugin.name, execute: plugin.execute, ctx, args };
    }
  }

  return { handled: false, reason: 'not_found' };
}

export function clearProcessedMessages() {
  processedMessages.clear();
}

export function getProcessedCount() {
  return processedMessages.size;
}

export default { routeCommand, isDuplicateMessage, clearProcessedMessages, getProcessedCount };
