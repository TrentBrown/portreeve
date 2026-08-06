// @ts-check

import { z } from 'zod';
import { PortSchema } from '../protocol/schemas.js';
import { runCommand } from '../supervision/command.js';

/**
 * @typedef {{
 *   availability: DockerCliAdapter['availability'],
 *   inspect: DockerCliAdapter['inspect'],
 *   findPublishedPort: DockerCliAdapter['findPublishedPort']
 * }} DockerEvidenceAdapter
 */

export const DockerContainerIdSchema = z.string().regex(/^[a-f0-9]{12,64}$/u);

const DockerInspectSchema = z
  .object({
    Id: DockerContainerIdSchema,
    State: z.object({ Running: z.boolean() }).passthrough(),
    Config: z
      .object({ Labels: z.record(z.string(), z.string()).nullable() })
      .passthrough(),
    NetworkSettings: z
      .object({
        Ports: z
          .record(
            z.string(),
            z
              .array(
                z.object({
                  HostIp: z.string(),
                  HostPort: z.string().regex(/^\d+$/u),
                }),
              )
              .nullable(),
          )
          .nullable(),
      })
      .passthrough(),
  })
  .passthrough();

export class DockerCliAdapter {
  /**
   * @param {{
   *   executable?: string,
   *   runner?: typeof runCommand
   * }} [options]
   */
  constructor(options = {}) {
    this.executable = options.executable ?? 'docker';
    this.runner = options.runner ?? runCommand;
  }

  async availability() {
    const result = await this.runner(this.executable, [
      'version',
      '--format',
      '{{.Server.Version}}',
    ]);
    return Object.freeze({
      available: result.code === 0 && result.stdout.trim().length > 0,
      reason:
        result.code === 0 && result.stdout.trim().length > 0
          ? null
          : dockerFailureReason(result),
    });
  }

  /** @param {string} requestedContainerId */
  async inspect(requestedContainerId) {
    const containerId = DockerContainerIdSchema.parse(requestedContainerId);
    const result = await this.runner(this.executable, [
      'inspect',
      '--type',
      'container',
      containerId,
    ]);
    if (result.code !== 0) {
      return Object.freeze({
        status: /** @type {'unavailable' | 'missing'} */ (
          result.code === 127 ? 'unavailable' : 'missing'
        ),
        reason: dockerFailureReason(result),
        container: null,
      });
    }
    let decoded;
    try {
      decoded = JSON.parse(result.stdout);
    } catch (error) {
      return Object.freeze({
        status: /** @type {const} */ ('unavailable'),
        reason: `invalid-inspect-json:${safeMessage(error)}`,
        container: null,
      });
    }
    const parsed = z.array(DockerInspectSchema).length(1).safeParse(decoded);
    if (!parsed.success) {
      return Object.freeze({
        status: /** @type {const} */ ('unavailable'),
        reason: 'invalid-inspect-shape',
        container: null,
      });
    }
    const container = parsed.data[0];
    if (container === undefined) {
      throw new Error('Docker inspect validation accepted an empty response.');
    }
    return Object.freeze({
      status: /** @type {const} */ ('ok'),
      reason: null,
      container: normalizeContainer(container),
    });
  }

  /** @param {number} requestedPort */
  async findPublishedPort(requestedPort) {
    const port = PortSchema.parse(requestedPort);
    const listed = await this.runner(this.executable, [
      'ps',
      '--quiet',
      '--no-trunc',
    ]);
    if (listed.code !== 0) {
      return Object.freeze({
        available: false,
        reason: dockerFailureReason(listed),
        containers: [],
      });
    }
    const ids = listed.stdout
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean);
    const containers = [];
    for (const id of ids) {
      const parsedId = DockerContainerIdSchema.safeParse(id);
      if (!parsedId.success) continue;
      const inspected = await this.inspect(parsedId.data);
      if (
        inspected.status === 'ok' &&
        inspected.container.ports.some((binding) => binding.hostPort === port)
      ) {
        containers.push(inspected.container);
      }
    }
    return Object.freeze({ available: true, reason: null, containers });
  }
}

/** @param {z.infer<typeof DockerInspectSchema>} input */
function normalizeContainer(input) {
  const ports = [];
  for (const [key, bindings] of Object.entries(input.NetworkSettings.Ports ?? {})) {
    const match = /^(\d+)\/tcp$/u.exec(key);
    if (match === null || bindings === null) continue;
    const matchedPort = match[1];
    if (matchedPort === undefined) continue;
    const containerPort = Number.parseInt(matchedPort, 10);
    for (const binding of bindings) {
      const hostPort = Number.parseInt(binding.HostPort, 10);
      if (
        PortSchema.safeParse(containerPort).success &&
        PortSchema.safeParse(hostPort).success
      ) {
        ports.push({
          containerPort,
          hostIp: binding.HostIp,
          hostPort,
        });
      }
    }
  }
  return Object.freeze({
    id: input.Id,
    running: input.State.Running,
    labels: Object.freeze({ ...(input.Config.Labels ?? {}) }),
    ports: Object.freeze(ports),
  });
}

/** @param {{code: number, stdout: string, stderr: string}} result */
function dockerFailureReason(result) {
  if (result.code === 127) return 'docker-executable-unavailable';
  const detail = (result.stderr || result.stdout).trim().replace(/\s+/gu, ' ');
  return detail.length === 0
    ? `docker-command-failed:${result.code}`
    : `docker-command-failed:${result.code}:${detail.slice(0, 240)}`;
}

/** @param {unknown} error */
function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
