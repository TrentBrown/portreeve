// @ts-check

import {
  PortreeveClient,
  PortreeveClientError,
} from '../../../packages/client/src/index.js';
import { EXIT_CODES } from '../../protocol/constants.js';
import { CliUsageError, setExitCode } from '../exit.js';
import { renderOutput } from '../output/render.js';

/**
 * @param {{socket?: string, json?: boolean}} options
 */
export async function statusCommand(options) {
  const client = clientFor(options.socket);
  try {
    const health = await client.health();
    const status = {
      running: true,
      socketPath: client.socketPath,
      server: health,
    };
    renderOutput(options.json ?? false, 'status', status, [
      `PortReeve is running at ${client.socketPath}.`,
      `Server version: ${health.softwareVersion}`,
    ]);
  } catch (error) {
    if (!(error instanceof PortreeveClientError) || error.code !== 'unavailable') {
      throw error;
    }
    const status = {
      running: false,
      socketPath: client.socketPath,
      server: null,
    };
    setExitCode(EXIT_CODES.stateDifference);
    renderOutput(options.json ?? false, 'status', status, [
      `PortReeve is not running at ${client.socketPath}.`,
    ]);
  }
}

/**
 * @param {{
 *   socket?: string,
 *   json?: boolean,
 *   limit?: string,
 *   eventType?: string,
 *   entityType?: string,
 *   entityId?: string,
 *   since?: string
 * }} options
 */
export async function historyCommand(options) {
  const events = await clientFor(options.socket).history({
    limit: parseLimit(options.limit),
    ...(options.eventType ? { eventType: options.eventType } : {}),
    ...(options.entityType ? { entityType: options.entityType } : {}),
    ...(options.entityId ? { entityId: options.entityId } : {}),
    ...(options.since ? { since: options.since } : {}),
  });
  renderOutput(
    options.json ?? false,
    'events',
    events,
    events.length === 0
      ? ['No matching PortReeve history events.']
      : events.map(
          (event) =>
            `${event.occurredAt}  ${event.eventType}  ${event.entityType}:${event.entityId}`,
        ),
  );
}

/**
 * @param {{socket?: string, json?: boolean, limit?: string}} options
 */
export async function logsCommand(options) {
  const entries = await clientFor(options.socket).logs({
    limit: parseLimit(options.limit),
  });
  renderOutput(
    options.json ?? false,
    'entries',
    entries,
    entries.length === 0
      ? ['No PortReeve diagnostic log entries.']
      : entries.map(
          (entry) =>
            `${entry.timestamp}  ${entry.level.padEnd(5)}  ${entry.component}  ${entry.message}`,
        ),
  );
}

/**
 * @param {string | undefined} value
 */
function parseLimit(value) {
  if (value === undefined) {
    return 100;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 10_000) {
    throw new CliUsageError('--limit must be an integer from 1 through 10000.');
  }
  return parsed;
}

/**
 * @param {string | undefined} socketPath
 */
function clientFor(socketPath) {
  return new PortreeveClient({
    ...(socketPath ? { socketPath } : {}),
  });
}
