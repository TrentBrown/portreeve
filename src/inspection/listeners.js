// @ts-check

import { inspectProcess } from './processes.js';
import { PortSchema } from '../protocol/schemas.js';

/**
 * @param {number} requestedPort
 */
export async function inspectTcpListeners(requestedPort) {
  const port = PortSchema.parse(requestedPort);
  return inspectListeners(['-nP', '-a', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpcn']);
}

export async function inspectAllTcpListeners() {
  return inspectListeners(['-nP', '-a', '-iTCP', '-sTCP:LISTEN', '-Fpcn']);
}

/**
 * @param {string[]} arguments_
 */
async function inspectListeners(arguments_) {
  const child = Bun.spawn(['lsof', ...arguments_], {
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const exitCode = await child.exited;
  const output = await new Response(child.stdout).text();
  const error = await new Response(child.stderr).text();

  if (exitCode !== 0 && exitCode !== 1) {
    throw new Error(`lsof failed with exit code ${exitCode}: ${error.trim()}`);
  }

  const listeners = parseLsofFields(output);
  const processCache = new Map();
  return Promise.all(
    listeners.map(async (listener) => {
      let processInspection = processCache.get(listener.pid);
      if (processInspection === undefined) {
        processInspection = inspectProcess(listener.pid);
        processCache.set(listener.pid, processInspection);
      }
      return {
        ...listener,
        process: await processInspection,
      };
    }),
  );
}

/**
 * @param {string} output
 */
export function parseLsofFields(output) {
  /** @type {Map<string, {pid: number, port: number, command: string | null, names: string[]}>} */
  const listeners = new Map();
  let pid = null;
  let command = null;

  for (const line of output.split('\n')) {
    if (line.startsWith('p')) {
      const parsedPid = Number.parseInt(line.slice(1), 10);
      if (!Number.isSafeInteger(parsedPid) || parsedPid <= 0) {
        throw new Error(`Invalid lsof PID field: ${line}`);
      }
      pid = parsedPid;
      command = null;
    } else if (line.startsWith('c') && pid !== null) {
      command = line.slice(1);
    } else if (line.startsWith('n') && pid !== null) {
      const name = line.slice(1);
      const match = name.match(/:(\d+)$/);
      if (match === null) {
        continue;
      }
      const port = PortSchema.parse(Number.parseInt(match[1] ?? '', 10));
      const key = `${pid}:${port}`;
      const listener = listeners.get(key) ?? {
        pid,
        port,
        command,
        names: [],
      };
      listener.command = command;
      listener.names.push(name);
      listeners.set(key, listener);
    }
  }

  return [...listeners.values()];
}
