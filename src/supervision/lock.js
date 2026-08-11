// @ts-check

import { randomUUID } from 'node:crypto';
import { chmod, lstat, unlink } from 'node:fs/promises';
import { createConnection, createServer } from 'node:net';
import { dirname } from 'node:path';
import { ensurePrivateDirectory } from '../platform/paths.js';

export class LifecycleBusyError extends Error {
  /** @param {string | null} activeOperation */
  constructor(activeOperation = null) {
    super(
      activeOperation === null
        ? 'Another PortReeve lifecycle mutation is active.'
        : `Another PortReeve lifecycle mutation is active (${activeOperation}).`,
    );
    this.name = 'LifecycleBusyError';
    this.code = 'lifecycle_busy';
    this.activeOperation = activeOperation;
  }
}

export class LifecycleMutationLock {
  /**
   * @param {{
   *   path: string,
   *   uid?: number,
   *   now?: () => Date,
   *   probeTimeoutMilliseconds?: number
   * }} options
   */
  constructor(options) {
    this.path = options.path;
    this.uid =
      options.uid ??
      (typeof process.getuid === 'function' ? process.getuid() : undefined);
    this.now = options.now ?? (() => new Date());
    this.probeTimeoutMilliseconds = options.probeTimeoutMilliseconds ?? 250;
  }

  /** @param {string} operation */
  async acquire(operation) {
    await ensurePrivateDirectory(dirname(this.path));
    const metadata = Object.freeze({
      schemaVersion: 1,
      ownerToken: randomUUID(),
      operation,
      pid: process.pid,
      uid: this.uid ?? null,
      acquiredAt: this.now().toISOString(),
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const server = createServer((socket) => {
        socket.end(`${JSON.stringify(metadata)}\n`);
      });
      try {
        await listen(server, this.path);
        await chmod(this.path, 0o600);
        return new LifecycleLockLease(server, metadata);
      } catch (error) {
        await closeQuietly(server);
        if (!hasCode(error, 'EADDRINUSE')) throw error;
      }

      const evidence = await probeListener(this.path, this.probeTimeoutMilliseconds);
      if (evidence.active) {
        throw new LifecycleBusyError(evidence.operation);
      }
      await this.removeAbandonedSocket();
    }

    throw new LifecycleBusyError(null);
  }

  async removeAbandonedSocket() {
    let information;
    try {
      information = await lstat(this.path);
    } catch (error) {
      if (hasCode(error, 'ENOENT')) return;
      throw error;
    }
    if (
      !information.isSocket() ||
      information.isSymbolicLink() ||
      (this.uid !== undefined && information.uid !== this.uid)
    ) {
      throw new LifecycleBusyError(null);
    }
    await unlink(this.path).catch((error) => {
      if (!hasCode(error, 'ENOENT')) throw error;
    });
  }
}

class LifecycleLockLease {
  /**
   * @param {import('node:net').Server} server
   * @param {{operation: string, ownerToken: string}} metadata
   */
  constructor(server, metadata) {
    this.server = server;
    this.metadata = metadata;
    this.released = false;
  }

  async release() {
    if (this.released) return;
    this.released = true;
    await new Promise((resolvePromise, reject) => {
      this.server.close((/** @type {Error | undefined} */ error) => {
        if (error) reject(error);
        else resolvePromise(undefined);
      });
    });
  }
}

/**
 * @param {import('node:net').Server} server
 * @param {string} path
 */
function listen(server, path) {
  return new Promise((resolvePromise, reject) => {
    /** @param {Error} error */
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolvePromise(undefined);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(path);
  });
}

/**
 * @param {string} path
 * @param {number} timeoutMilliseconds
 */
function probeListener(path, timeoutMilliseconds) {
  return new Promise((resolvePromise) => {
    let settled = false;
    let connected = false;
    let content = '';
    const socket = createConnection(path);
    /** @param {{active: boolean, operation: string | null}} result */
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolvePromise(result);
    };
    const timer = setTimeout(() => {
      finish({ active: connected, operation: null });
    }, timeoutMilliseconds);
    timer.unref?.();
    socket.setEncoding('utf8');
    socket.once('connect', () => {
      connected = true;
    });
    socket.on('data', (chunk) => {
      content += chunk;
      if (content.length > 4096) content = content.slice(0, 4096);
    });
    socket.once('end', () => {
      finish({ active: true, operation: parseOperation(content) });
    });
    socket.once('error', (error) => {
      finish(
        connected || !hasAnyCode(error, ['ECONNREFUSED', 'ENOENT'])
          ? { active: true, operation: null }
          : { active: false, operation: null },
      );
    });
  });
}

/** @param {string} content */
function parseOperation(content) {
  try {
    const value = JSON.parse(content.trim());
    return typeof value.operation === 'string' ? value.operation : null;
  } catch {
    return null;
  }
}

/** @param {import('node:net').Server} server */
function closeQuietly(server) {
  return new Promise((resolvePromise) => {
    if (!server.listening) {
      resolvePromise(undefined);
      return;
    }
    server.close(() => resolvePromise(undefined));
  });
}

/** @param {unknown} error @param {string} code */
function hasCode(error, code) {
  return (
    error instanceof Error &&
    'code' in error &&
    /** @type {{code?: unknown}} */ (error).code === code
  );
}

/** @param {unknown} error @param {string[]} codes */
function hasAnyCode(error, codes) {
  return codes.some((code) => hasCode(error, code));
}
