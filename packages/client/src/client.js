// @ts-check

import { request as httpRequest } from 'node:http';
import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { PORTREEVE_PROTOCOL_RANGE } from './constants.js';
import { PORTREEVE_CLIENT_VERSION } from './version.js';

const execFileAsync = promisify(execFile);

const clientCompatibility = Object.freeze({
  softwareVersion: PORTREEVE_CLIENT_VERSION,
  protocol: PORTREEVE_PROTOCOL_RANGE,
  requiredCapabilities: ['two-phase-allocation-v1'],
});

export class PortreeveClientError extends Error {
  /**
   * @param {string} message
   * @param {{
   *   code: string,
   *   status?: number,
   *   requestId?: string,
   *   retryable?: boolean,
   *   details?: Record<string, unknown>
   * }} options
   */
  constructor(message, options) {
    super(message);
    this.name = 'PortreeveClientError';
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
    this.details = options.details ?? {};
  }
}

export class PortreeveClient {
  /**
   * @param {{socketPath?: string}} [options]
   */
  constructor(options = {}) {
    this.socketPath = options.socketPath ?? defaultSocketPath();
  }

  async health() {
    return requestJson(this.socketPath, 'GET', '/v1/health');
  }

  async stopServer() {
    return requestJson(
      this.socketPath,
      'POST',
      '/v1/server/stop',
      withClient({}, ['lifecycle-control-v1']),
    );
  }

  /**
   * @param {Record<string, string | number | boolean | undefined>} [filters]
   */
  async listPorts(filters = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) {
        search.set(key, String(value));
      }
    }
    const query = search.size === 0 ? '' : `?${search}`;
    return requestJson(this.socketPath, 'GET', `/v1/ports${query}`);
  }

  /**
   * @param {number} port
   */
  async inspectPort(port) {
    return requestJson(this.socketPath, 'GET', `/v1/ports/${port}`);
  }

  async listClaims() {
    return requestJson(this.socketPath, 'GET', '/v1/claims');
  }

  /**
   * @param {{workspaceRoot: string, definition: unknown}} request
   */
  async applyStack(request) {
    const workspaceRoot = await canonicalWorkspaceRoot(request.workspaceRoot);
    return requestJson(
      this.socketPath,
      'POST',
      '/v1/stacks/apply',
      withClient({ workspaceRoot, definition: request.definition }, [
        'stack-definitions-v1',
      ]),
    );
  }

  /** @param {{project?: string, workspaceRoot?: string}} [filters] */
  async listStacks(filters = {}) {
    const normalized = { ...filters };
    if (filters.workspaceRoot !== undefined) {
      normalized.workspaceRoot = await canonicalWorkspaceRoot(filters.workspaceRoot);
    }
    return requestJson(this.socketPath, 'GET', `/v1/stacks${queryString(normalized)}`);
  }

  /** @param {string} stackId */
  async getStack(stackId) {
    return requestJson(this.socketPath, 'GET', `/v1/stacks/${stackId}`);
  }

  /**
   * @param {string} claimId
   */
  async getClaim(claimId) {
    return requestJson(this.socketPath, 'GET', `/v1/claims/${claimId}`);
  }

  /**
   * @param {string} claimId
   * @param {{preferredPort?: number, exactPort?: number}} [options]
   */
  async reassignClaim(claimId, options = {}) {
    return requestJson(
      this.socketPath,
      'POST',
      `/v1/claims/${claimId}/reassign`,
      withClient(options, ['administration-v1']),
    );
  }

  /**
   * @param {string} claimId
   */
  async deleteClaim(claimId) {
    return requestJson(
      this.socketPath,
      'POST',
      `/v1/claims/${claimId}/delete`,
      withClient({}, ['administration-v1']),
    );
  }

  /**
   * @param {{olderThanMilliseconds: number, dryRun: boolean}} options
   */
  async pruneClaims(options) {
    return requestJson(
      this.socketPath,
      'POST',
      '/v1/claims/prune',
      withClient(options, ['administration-v1']),
    );
  }

  async getConfig() {
    return requestJson(this.socketPath, 'GET', '/v1/config');
  }

  /**
   * @param {Record<string, unknown>} updates
   */
  async setConfig(updates) {
    return requestJson(
      this.socketPath,
      'POST',
      '/v1/config',
      withClient({ updates }, ['administration-v1']),
    );
  }

  /**
   * @param {{
   *   limit?: number,
   *   eventType?: string,
   *   entityType?: string,
   *   entityId?: string,
   *   since?: string
   * }} [filters]
   */
  async history(filters = {}) {
    return requestJson(this.socketPath, 'GET', `/v1/history${queryString(filters)}`);
  }

  /**
   * @param {{limit?: number}} [options]
   */
  async logs(options = {}) {
    return requestJson(this.socketPath, 'GET', `/v1/logs${queryString(options)}`);
  }

  /**
   * @param {number} port
   * @param {{
   *   policy: 'never' | 'graceful' | 'force-after-grace',
   *   dryRun?: boolean
   * }} options
   */
  async reclaimPort(port, options) {
    return requestJson(
      this.socketPath,
      'POST',
      `/v1/ports/${port}/reclaim`,
      withClient(
        {
          policy: options.policy,
          dryRun: options.dryRun ?? false,
        },
        ['reclamation-v1'],
      ),
    );
  }

  /**
   * @param {number} port
   * @param {{
   *   unsafeAnyOwner: true,
   *   policy?: 'graceful' | 'force-after-grace',
   *   dryRun?: boolean
   * }} options
   */
  async unsafeEvictPort(port, options) {
    return requestJson(
      this.socketPath,
      'POST',
      `/v1/ports/${port}/unsafe-evict`,
      withClient(
        {
          unsafeAnyOwner: options.unsafeAnyOwner,
          policy: options.policy ?? 'graceful',
          dryRun: options.dryRun ?? false,
        },
        ['reclamation-v1'],
      ),
    );
  }

  /**
   * @param {{
   *   claim: {
   *     project: string,
   *     workspaceRoot: string,
   *     service?: string,
   *     component?: string,
   *     endpoint?: string,
   *     transport?: 'tcp'
   *   },
   *   allocation?: {
   *     mode?: 'sticky' | 'ephemeral',
   *     preferredPort?: number,
   *     exactPort?: number,
   *     replacementPolicy?: 'never' | 'graceful' | 'force-after-grace'
   *   }
   * }} request
   */
  async acquire(request) {
    const workspaceRoot = await canonicalWorkspaceRoot(request.claim.workspaceRoot);
    return requestJson(
      this.socketPath,
      'POST',
      '/v1/leases/acquire',
      withClient({
        claim: {
          ...request.claim,
          workspaceRoot,
          transport: request.claim.transport ?? 'tcp',
        },
        allocation: {
          mode: 'sticky',
          replacementPolicy: 'never',
          ...request.allocation,
        },
      }),
    );
  }

  /**
   * @param {{leaseId: string, leaseToken: string}} lease
   * @param {{rootPid?: number}} [options]
   */
  async confirm(lease, options = {}) {
    return requestJson(
      this.socketPath,
      'POST',
      `/v1/leases/${lease.leaseId}/confirm`,
      withClient({
        leaseToken: lease.leaseToken,
        rootPid: options.rootPid ?? process.pid,
      }),
    );
  }

  /**
   * @param {{leaseId: string, leaseToken: string}} lease
   * @param {'address-in-use' | 'startup-error' | 'client-cancelled'} reason
   */
  async abandon(lease, reason) {
    return requestJson(
      this.socketPath,
      'POST',
      `/v1/leases/${lease.leaseId}/abandon`,
      withClient({ leaseToken: lease.leaseToken, reason }),
    );
  }

  /**
   * @param {string} runId
   */
  async release(runId) {
    return requestJson(
      this.socketPath,
      'POST',
      `/v1/runs/${runId}/release`,
      withClient({}),
    );
  }

  /**
   * @template T
   * @param {Parameters<PortreeveClient['acquire']>[0] & {
   *   maxAttempts?: number,
   *   rootPid?: number
   * }} request
   * @param {(port: number) => Promise<T>} start
   */
  async withPort(request, start) {
    const maxAttempts = request.maxAttempts ?? 3;
    let lastCollision;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const lease = await this.acquire(request);
      try {
        const value = await start(lease.port);
        const run = await this.confirm(
          lease,
          request.rootPid === undefined ? {} : { rootPid: request.rootPid },
        );
        return Object.freeze({
          port: lease.port,
          run,
          value,
          release: () => this.release(run.runId),
        });
      } catch (error) {
        const collision = isAddressInUse(error);
        await this.abandon(lease, collision ? 'address-in-use' : 'startup-error').catch(
          () => {},
        );
        if (!collision) {
          throw error;
        }
        lastCollision = error;
      }
    }

    throw new PortreeveClientError(
      `Service failed to bind after ${maxAttempts} Portreeve attempts.`,
      {
        code: 'bind_retry_exhausted',
        details: { cause: String(lastCollision) },
      },
    );
  }
}

export function defaultSocketPath() {
  if (process.env.PORTREEVE_SOCKET) {
    return resolve(process.env.PORTREEVE_SOCKET);
  }
  const applicationDirectory =
    process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Application Support', 'Portreeve')
      : join(
          process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'),
          'portreeve',
        );
  return join(applicationDirectory, 'portreeve.sock');
}

/**
 * @param {Record<string, string | number | boolean | undefined>} values
 */
function queryString(values) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  return search.size === 0 ? '' : `?${search}`;
}

/**
 * Resolve a caller-supplied project path to its real Git worktree root. Outside
 * Git, the real caller-supplied project root is retained.
 *
 * @param {string} projectPath
 */
export async function canonicalWorkspaceRoot(projectPath) {
  const canonicalPath = await realpath(projectPath);
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', canonicalPath, 'rev-parse', '--path-format=absolute', '--show-toplevel'],
      { encoding: 'utf8' },
    );
    return await realpath(stdout.trim());
  } catch {
    return canonicalPath;
  }
}

/**
 * @param {Record<string, unknown>} body
 * @param {string[]} [requiredCapabilities]
 */
function withClient(
  body,
  requiredCapabilities = [...clientCompatibility.requiredCapabilities],
) {
  return {
    client: {
      ...clientCompatibility,
      requiredCapabilities,
    },
    ...body,
  };
}

/**
 * @param {string} socketPath
 * @param {'GET' | 'POST'} method
 * @param {string} path
 * @param {Record<string, unknown>} [body]
 */
function requestJson(socketPath, method, path, body) {
  return new Promise((resolvePromise, reject) => {
    const serialized = body === undefined ? null : JSON.stringify(body);
    const requestId = randomUUID();
    const request = httpRequest(
      {
        socketPath,
        path,
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-portreeve-request-id': requestId,
          ...(serialized === null
            ? {}
            : { 'content-length': Buffer.byteLength(serialized) }),
        },
      },
      (response) => {
        response.setEncoding('utf8');
        let content = '';
        response.on('data', (chunk) => {
          content += chunk;
        });
        response.on('end', () => {
          try {
            let envelope;
            try {
              envelope = JSON.parse(content);
            } catch {
              throw new PortreeveClientError(
                'Portreeve returned a non-JSON response.',
                {
                  code: 'invalid_response',
                  ...(response.statusCode === undefined
                    ? {}
                    : { status: response.statusCode }),
                  requestId,
                },
              );
            }
            if (
              !isObject(envelope) ||
              envelope.protocolVersion !== PORTREEVE_PROTOCOL_RANGE.maximum
            ) {
              throw new PortreeveClientError(
                `Portreeve returned unsupported protocol version ${String(
                  isObject(envelope) ? envelope.protocolVersion : undefined,
                )}. Update the Portreeve client or server.`,
                {
                  code: 'incompatible_protocol',
                  ...(response.statusCode === undefined
                    ? {}
                    : { status: response.statusCode }),
                  requestId,
                },
              );
            }
            if (
              response.statusCode !== undefined &&
              response.statusCode >= 200 &&
              response.statusCode < 300 &&
              'data' in envelope
            ) {
              resolvePromise(envelope.data);
              return;
            }

            const error = isObject(envelope) ? envelope.error : null;
            throw new PortreeveClientError(
              isObject(error) && typeof error.message === 'string'
                ? error.message
                : `Portreeve returned HTTP ${response.statusCode}.`,
              {
                code:
                  isObject(error) && typeof error.code === 'string'
                    ? error.code
                    : 'invalid_response',
                ...(response.statusCode === undefined
                  ? {}
                  : { status: response.statusCode }),
                requestId:
                  isObject(envelope) && typeof envelope.requestId === 'string'
                    ? envelope.requestId
                    : requestId,
                retryable:
                  isObject(error) && typeof error.retryable === 'boolean'
                    ? error.retryable
                    : false,
                details:
                  isObject(error) && isObject(error.details) ? error.details : {},
              },
            );
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on('error', (error) => {
      reject(
        new PortreeveClientError(
          `Portreeve is unavailable at ${socketPath}: ${error.message}. Start it with "portreeve serve" or "portreeve start".`,
          {
            code: 'unavailable',
            details: { socketPath, cause: error.message },
          },
        ),
      );
    });
    if (serialized !== null) {
      request.write(serialized);
    }
    request.end();
  });
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isAddressInUse(error) {
  if (!isObject(error)) {
    return false;
  }
  if (error.code === 'EADDRINUSE') {
    return true;
  }
  return 'cause' in error && isAddressInUse(error.cause);
}
