// @ts-check

import { chmod, lstat, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import { z } from 'zod';
import { AdministrationService } from '../administration/service.js';
import { ServerSettingsSchema } from '../domain/settings.js';
import { CAPABILITIES, DOCKER_CAPABILITY } from '../protocol/constants.js';
import {
  AbandonRequestSchema,
  AcquireRequestSchema,
  AcquireResponseSchema,
  ClaimDeleteRequestSchema,
  ClaimPruneRequestSchema,
  ClaimPruneResultSchema,
  ClaimReassignRequestSchema,
  ClaimRecordResponseSchema,
  ClaimsListSchema,
  ConfigSetRequestSchema,
  ConfirmRequestSchema,
  ConfirmResponseSchema,
  DiagnosticLogListSchema,
  ErrorEnvelopeSchema,
  HistoryListSchema,
  IdentifierSchema,
  InventoryClassificationSchema,
  InventoryEntrySchema,
  InventoryListSchema,
  MutationAcknowledgementSchema,
  PORTREEVE_HEALTH,
  PortSchema,
  ReclaimRequestSchema,
  ReclamationResultSchema,
  ReleaseRequestSchema,
  ServerSettingsResponseSchema,
  StackApplyRequestSchema,
  StackApplyResponseSchema,
  StackActivationSchema,
  StackBeginActivationRequestSchema,
  StackBeginActivationResponseSchema,
  StackListSchema,
  StackPrepareRequestSchema,
  StackPrepareResponseSchema,
  StackPruneRequestSchema,
  StackPruneResultSchema,
  StackReconcileActivationRequestSchema,
  StackReconcileActivationResponseSchema,
  StackRecordSchema,
  StackRenewActivationRequestSchema,
  StackRenewActivationResponseSchema,
  StackConfirmEndpointRequestSchema,
  StackEndActivationRequestSchema,
  StackEndActivationResponseSchema,
  StackEndpointSnapshotSchema,
  StackGenerationSchema,
  StackResolutionSchema,
  StackResolveRequestSchema,
  StackSnapshotRequestSchema,
  StackStatusRequestSchema,
  StackStatusSchema,
  StackAbandonEndpointRequestSchema,
  StackSkipEndpointRequestSchema,
  UnsafeEvictionRequestSchema,
  negotiateCompatibility,
  successEnvelopeSchema,
} from '../protocol/schemas.js';
import { InventoryService } from '../reconciliation/inventory.js';
import { ReclamationService } from '../reclamation/service.js';
import { RegistryError } from '../storage/registry.js';
import { StackCoordinationService } from '../stacks/coordination-service.js';
import { StackAdministrationService } from '../stacks/administration-service.js';
import { StackDiscoveryService } from '../stacks/discovery-service.js';
import { StackDefinitionService } from '../stacks/service.js';

/**
 * @param {{
 *   socketPath: string,
 *   allocationService: import('../allocation/service.js').AllocationService,
 *   inventoryService?: InventoryService,
 *   reclamationService?: ReclamationService,
 *   administrationService?: AdministrationService,
 *   stackDefinitionService?: StackDefinitionService,
 *   stackCoordinationService?: StackCoordinationService,
 *   stackAdministrationService?: StackAdministrationService,
 *   stackDiscoveryService?: StackDiscoveryService,
 *   dockerAdapter?: import('../docker/adapter.js').DockerEvidenceAdapter | null,
 *   diagnosticLog?: import('../observability/diagnostic-log.js').DiagnosticLog,
 *   mode?: 'manual' | 'supervised'
 * }} options
 */
export async function startPortreeveServer(options) {
  await removeStaleSocket(options.socketPath);

  const dockerAdapter = options.dockerAdapter ?? null;
  const dockerAvailability =
    dockerAdapter === null
      ? { available: false, reason: 'docker-adapter-not-configured' }
      : await dockerAdapter.availability();
  const capabilities = dockerAvailability.available
    ? Object.freeze([...CAPABILITIES, DOCKER_CAPABILITY])
    : CAPABILITIES;

  const inventoryService =
    options.inventoryService ??
    new InventoryService({
      registry: options.allocationService.registry,
      dockerAdapter: dockerAvailability.available ? dockerAdapter : null,
    });
  const reclamationService =
    options.reclamationService ??
    new ReclamationService({
      registry: options.allocationService.registry,
      inventoryService,
    });
  const administrationService =
    options.administrationService ??
    new AdministrationService({
      registry: options.allocationService.registry,
      inventoryService,
    });
  const stackDefinitionService =
    options.stackDefinitionService ??
    new StackDefinitionService({ registry: options.allocationService.registry });
  const stackCoordinationService =
    options.stackCoordinationService ??
    new StackCoordinationService({
      registry: options.allocationService.registry,
      allocationService: options.allocationService,
      inventoryService,
      ...(dockerAdapter === null ? {} : { dockerAdapter }),
    });
  const stackDiscoveryService =
    options.stackDiscoveryService ??
    new StackDiscoveryService({
      registry: options.allocationService.registry,
      coordinationService: stackCoordinationService,
    });
  const stackAdministrationService =
    options.stackAdministrationService ??
    new StackAdministrationService({
      registry: options.allocationService.registry,
      coordinationService: stackCoordinationService,
      inventoryService,
      dockerAdapter,
    });
  const diagnosticLog = options.diagnosticLog;
  let stopped = false;
  let resolveStopped = () => {};
  const stoppedPromise = new Promise((resolvePromise) => {
    resolveStopped = () => resolvePromise(undefined);
  });
  /** @type {Bun.Server<undefined>} */
  let server;

  async function stop() {
    if (stopped) {
      return;
    }
    stopped = true;
    writeDiagnostic(diagnosticLog, 'info', 'server', 'Portreeve server stopped.', {
      pid: process.pid,
    });
    server.stop(true);
    await unlink(options.socketPath).catch((error) => {
      if (!isMissingFile(error)) {
        throw error;
      }
    });
    resolveStopped();
  }

  server = Bun.serve({
    unix: options.socketPath,
    fetch(request) {
      return handleRequest(
        request,
        options.allocationService,
        inventoryService,
        reclamationService,
        administrationService,
        stackDefinitionService,
        stackCoordinationService,
        stackDiscoveryService,
        stackAdministrationService,
        capabilities,
        diagnosticLog,
        options.mode ?? 'manual',
        () => {
          setTimeout(() => {
            void stop();
          }, 0);
        },
      );
    },
  });

  await chmod(options.socketPath, 0o600);
  writeDiagnostic(diagnosticLog, 'info', 'server', 'Portreeve server started.', {
    pid: process.pid,
  });
  writeDiagnostic(
    diagnosticLog,
    dockerAvailability.available ? 'info' : 'warn',
    'docker',
    dockerAvailability.available
      ? 'Docker evidence capability is available.'
      : 'Docker evidence capability is unavailable.',
    { reason: dockerAvailability.reason },
  );

  return Object.freeze({
    socketPath: options.socketPath,
    stop,
    waitUntilStopped() {
      return stoppedPromise;
    },
  });
}

/**
 * @param {Request} request
 * @param {import('../allocation/service.js').AllocationService} allocationService
 * @param {InventoryService} inventoryService
 * @param {ReclamationService} reclamationService
 * @param {AdministrationService} administrationService
 * @param {StackDefinitionService} stackDefinitionService
 * @param {StackCoordinationService} stackCoordinationService
 * @param {StackDiscoveryService} stackDiscoveryService
 * @param {StackAdministrationService} stackAdministrationService
 * @param {readonly string[]} capabilities
 * @param {import('../observability/diagnostic-log.js').DiagnosticLog | undefined} diagnosticLog
 * @param {'manual' | 'supervised'} mode
 * @param {() => void} requestStop
 */
async function handleRequest(
  request,
  allocationService,
  inventoryService,
  reclamationService,
  administrationService,
  stackDefinitionService,
  stackCoordinationService,
  stackDiscoveryService,
  stackAdministrationService,
  capabilities,
  diagnosticLog,
  mode,
  requestStop,
) {
  const requestId = requestIdFor(request);
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    if (request.method === 'GET' && pathname === '/v1/health') {
      return success(requestId, {
        ...PORTREEVE_HEALTH,
        capabilities,
        pid: process.pid,
        mode,
      });
    }
    if (request.method === 'GET' && pathname === '/v1/ports') {
      return success(
        requestId,
        InventoryListSchema.parse(await inventoryService.list(inventoryFilters(url))),
      );
    }
    if (request.method === 'GET' && pathname === '/v1/stacks') {
      return success(
        requestId,
        StackListSchema.parse(
          stackDefinitionService.list({
            ...(url.searchParams.has('project')
              ? { project: url.searchParams.get('project') ?? '' }
              : {}),
            ...(url.searchParams.has('workspaceRoot')
              ? { workspaceRoot: url.searchParams.get('workspaceRoot') ?? '' }
              : {}),
          }),
        ),
      );
    }
    const showActivation = pathname.match(/^\/v1\/stack-activations\/([0-9a-f-]+)$/);
    if (request.method === 'GET' && showActivation !== null) {
      return success(
        requestId,
        StackActivationSchema.parse(
          stackCoordinationService.get(IdentifierSchema.parse(showActivation[1])),
        ),
      );
    }
    const showGeneration = pathname.match(/^\/v1\/stack-generations\/([0-9a-f-]+)$/);
    if (request.method === 'GET' && showGeneration !== null) {
      return success(
        requestId,
        StackGenerationSchema.parse(
          stackCoordinationService.getGeneration(
            IdentifierSchema.parse(showGeneration[1]),
          ),
        ),
      );
    }
    const showStack = pathname.match(/^\/v1\/stacks\/([0-9a-f-]+)$/);
    if (request.method === 'GET' && showStack !== null) {
      return success(
        requestId,
        StackRecordSchema.parse(
          stackDefinitionService.get(IdentifierSchema.parse(showStack[1])),
        ),
      );
    }
    if (request.method === 'GET' && pathname === '/v1/claims') {
      return success(
        requestId,
        ClaimsListSchema.parse(administrationService.listClaims()),
      );
    }
    const showClaim = pathname.match(/^\/v1\/claims\/([0-9a-f-]+)$/);
    if (request.method === 'GET' && showClaim !== null) {
      return success(
        requestId,
        ClaimRecordResponseSchema.parse(
          administrationService.getClaim(IdentifierSchema.parse(showClaim[1])),
        ),
      );
    }
    if (request.method === 'GET' && pathname === '/v1/config') {
      return success(
        requestId,
        ServerSettingsResponseSchema.parse(allocationService.registry.getSettings()),
      );
    }
    if (request.method === 'GET' && pathname === '/v1/history') {
      return success(
        requestId,
        HistoryListSchema.parse(
          allocationService.registry.listHistory(historyFilters(url)),
        ),
      );
    }
    if (request.method === 'GET' && pathname === '/v1/logs') {
      return success(
        requestId,
        DiagnosticLogListSchema.parse(diagnosticLog?.read(queryLimit(url, 100)) ?? []),
      );
    }
    const inspectPort = pathname.match(/^\/v1\/ports\/(\d+)$/);
    if (request.method === 'GET' && inspectPort !== null) {
      const port = PortSchema.parse(Number.parseInt(inspectPort[1] ?? '', 10));
      return success(
        requestId,
        InventoryEntrySchema.parse(await inventoryService.inspect(port)),
      );
    }

    if (request.method !== 'POST') {
      return failure(requestId, 404, {
        code: 'not_found',
        message: `No Portreeve endpoint matches ${request.method} ${pathname}.`,
        retryable: false,
        details: {},
      });
    }

    const body = await request.json();
    if (pathname === '/v1/server/stop') {
      const requestBody = z
        .object({ client: z.record(z.string(), z.unknown()) })
        .passthrough()
        .parse(body);
      assertCompatible(
        /** @type {{protocol: {minimum: number, maximum: number}, requiredCapabilities: string[]}} */ (
          requestBody.client
        ),
      );
      requestStop();
      return success(
        requestId,
        MutationAcknowledgementSchema.parse({
          changed: true,
          at: new Date().toISOString(),
        }),
      );
    }
    if (pathname === '/v1/claims/prune') {
      const result = await administrationService.pruneClaims(
        ClaimPruneRequestSchema.parse(body),
      );
      return success(requestId, ClaimPruneResultSchema.parse(result));
    }
    if (pathname === '/v1/stacks/apply') {
      return success(
        requestId,
        StackApplyResponseSchema.parse(
          stackDefinitionService.apply(StackApplyRequestSchema.parse(body)),
        ),
      );
    }
    if (pathname === '/v1/stacks/prune') {
      return success(
        requestId,
        StackPruneResultSchema.parse(
          await stackAdministrationService.prune(StackPruneRequestSchema.parse(body)),
        ),
      );
    }
    const stackStatus = pathname.match(/^\/v1\/stacks\/([0-9a-f-]+)\/status$/);
    if (stackStatus !== null) {
      return success(
        requestId,
        StackStatusSchema.parse(
          await stackCoordinationService.status(
            IdentifierSchema.parse(stackStatus[1]),
            StackStatusRequestSchema.parse(body),
          ),
        ),
      );
    }
    const prepareStack = pathname.match(/^\/v1\/stacks\/([0-9a-f-]+)\/prepare$/);
    if (prepareStack !== null) {
      const stackId = IdentifierSchema.parse(prepareStack[1]);
      const requestBody = StackPrepareRequestSchema.parse({
        ...z.record(z.string(), z.unknown()).parse(body),
        stackId,
      });
      return success(
        requestId,
        StackPrepareResponseSchema.parse(
          await stackCoordinationService.prepare(requestBody),
        ),
      );
    }
    if (pathname === '/v1/stack-activations/begin') {
      return success(
        requestId,
        StackBeginActivationResponseSchema.parse(
          await stackCoordinationService.begin(
            StackBeginActivationRequestSchema.parse(body),
          ),
        ),
      );
    }
    const activationDiscovery = pathname.match(
      /^\/v1\/stack-activations\/([0-9a-f-]+)\/(resolve|snapshot)$/,
    );
    if (activationDiscovery !== null) {
      const activationId = IdentifierSchema.parse(activationDiscovery[1]);
      switch (activationDiscovery[2]) {
        case 'resolve':
          return success(
            requestId,
            StackResolutionSchema.parse(
              stackDiscoveryService.resolve(
                activationId,
                StackResolveRequestSchema.parse(body),
              ),
            ),
          );
        case 'snapshot':
          return success(
            requestId,
            StackEndpointSnapshotSchema.parse(
              stackDiscoveryService.snapshot(
                activationId,
                StackSnapshotRequestSchema.parse(body),
              ),
            ),
          );
      }
    }
    const activationMutation = pathname.match(
      /^\/v1\/stack-activations\/([0-9a-f-]+)\/(renew|confirm|abandon|skip|reconcile|end)$/,
    );
    if (activationMutation !== null) {
      const activationId = IdentifierSchema.parse(activationMutation[1]);
      switch (activationMutation[2]) {
        case 'renew':
          return success(
            requestId,
            StackRenewActivationResponseSchema.parse(
              stackCoordinationService.renew(
                activationId,
                StackRenewActivationRequestSchema.parse(body),
              ),
            ),
          );
        case 'confirm':
          return success(
            requestId,
            StackActivationSchema.parse(
              await stackCoordinationService.confirm(
                activationId,
                StackConfirmEndpointRequestSchema.parse(body),
              ),
            ),
          );
        case 'abandon':
          return success(
            requestId,
            StackActivationSchema.parse(
              stackCoordinationService.abandon(
                activationId,
                StackAbandonEndpointRequestSchema.parse(body),
              ),
            ),
          );
        case 'skip':
          return success(
            requestId,
            StackActivationSchema.parse(
              stackCoordinationService.skip(
                activationId,
                StackSkipEndpointRequestSchema.parse(body),
              ),
            ),
          );
        case 'end':
          return success(
            requestId,
            StackEndActivationResponseSchema.parse(
              await stackCoordinationService.end(
                activationId,
                StackEndActivationRequestSchema.parse(body),
              ),
            ),
          );
        case 'reconcile':
          return success(
            requestId,
            StackReconcileActivationResponseSchema.parse(
              await stackCoordinationService.reconcile(
                activationId,
                StackReconcileActivationRequestSchema.parse(body),
              ),
            ),
          );
      }
    }
    const reassignClaim = pathname.match(/^\/v1\/claims\/([0-9a-f-]+)\/reassign$/);
    if (reassignClaim !== null) {
      const result = await administrationService.reassignClaim(
        IdentifierSchema.parse(reassignClaim[1]),
        ClaimReassignRequestSchema.parse(body),
      );
      return success(requestId, ClaimRecordResponseSchema.parse(result));
    }
    const deleteClaim = pathname.match(/^\/v1\/claims\/([0-9a-f-]+)\/delete$/);
    if (deleteClaim !== null) {
      const claimId = IdentifierSchema.parse(deleteClaim[1]);
      const changed = await administrationService.deleteClaim(
        claimId,
        ClaimDeleteRequestSchema.parse(body),
      );
      return success(
        requestId,
        MutationAcknowledgementSchema.parse({
          changed,
          at: new Date().toISOString(),
        }),
      );
    }
    if (pathname === '/v1/config') {
      const requestBody = ConfigSetRequestSchema.parse(body);
      assertCompatible(requestBody.client);
      const registry = allocationService.registry;
      const current = registry.getSettings();
      for (const key of Object.keys(requestBody.updates)) {
        if (!(key in current)) {
          throw new RegistryError(
            'invalid_input',
            `Unknown Portreeve setting: ${key}.`,
            { key },
          );
        }
      }
      const settings = registry.setSettings(
        ServerSettingsSchema.parse({
          ...current,
          ...requestBody.updates,
        }),
      );
      writeDiagnostic(diagnosticLog, 'info', 'config', 'Server settings updated.', {
        keys: Object.keys(requestBody.updates),
      });
      return success(requestId, ServerSettingsResponseSchema.parse(settings));
    }
    const reclaim = pathname.match(/^\/v1\/ports\/(\d+)\/reclaim$/);
    if (reclaim !== null) {
      const port = PortSchema.parse(Number.parseInt(reclaim[1] ?? '', 10));
      const result = await reclamationService.reclaim(
        port,
        ReclaimRequestSchema.parse(body),
      );
      return success(requestId, ReclamationResultSchema.parse(result));
    }

    const unsafeEviction = pathname.match(/^\/v1\/ports\/(\d+)\/unsafe-evict$/);
    if (unsafeEviction !== null) {
      const port = PortSchema.parse(Number.parseInt(unsafeEviction[1] ?? '', 10));
      const result = await reclamationService.unsafeEvict(
        port,
        UnsafeEvictionRequestSchema.parse(body),
      );
      return success(requestId, ReclamationResultSchema.parse(result));
    }

    if (pathname === '/v1/leases/acquire') {
      const result = await allocationService.acquire(AcquireRequestSchema.parse(body));
      return success(requestId, AcquireResponseSchema.parse(result));
    }

    const confirm = pathname.match(/^\/v1\/leases\/([0-9a-f-]+)\/confirm$/);
    if (confirm !== null) {
      const leaseId = IdentifierSchema.parse(confirm[1]);
      const input = ConfirmRequestSchema.parse({ ...objectBody(body), leaseId });
      const run = await allocationService.confirm(input);
      return success(
        requestId,
        ConfirmResponseSchema.parse({
          claimId: run.claimId,
          leaseId: run.leaseId,
          runId: run.id,
          port: run.port,
          confirmedAt: run.confirmedAt,
        }),
      );
    }

    const abandon = pathname.match(/^\/v1\/leases\/([0-9a-f-]+)\/abandon$/);
    if (abandon !== null) {
      const leaseId = IdentifierSchema.parse(abandon[1]);
      const input = AbandonRequestSchema.parse({ ...objectBody(body), leaseId });
      const lease = allocationService.abandon(input);
      return success(
        requestId,
        MutationAcknowledgementSchema.parse({
          changed: lease?.state === 'abandoned' || lease?.state === 'collision',
          at: lease?.updatedAt ?? new Date().toISOString(),
        }),
      );
    }

    const release = pathname.match(/^\/v1\/runs\/([0-9a-f-]+)\/release$/);
    if (release !== null) {
      const runId = IdentifierSchema.parse(release[1]);
      const input = ReleaseRequestSchema.parse({ ...objectBody(body), runId });
      const changed = allocationService.release(input);
      return success(
        requestId,
        MutationAcknowledgementSchema.parse({
          changed,
          at: new Date().toISOString(),
        }),
      );
    }

    return failure(requestId, 404, {
      code: 'not_found',
      message: `No Portreeve endpoint matches POST ${pathname}.`,
      retryable: false,
      details: {},
    });
  } catch (error) {
    writeDiagnostic(diagnosticLog, 'error', 'protocol', 'Request failed.', {
      requestId,
      method: request.method,
      pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(requestId, error);
  }
}

/**
 * @param {string} requestId
 * @param {unknown} data
 */
function success(requestId, data) {
  return Response.json(
    successEnvelopeSchema(z.unknown()).parse({
      protocolVersion: 1,
      requestId,
      data,
    }),
  );
}

/**
 * @param {string} requestId
 * @param {unknown} error
 */
function errorResponse(requestId, error) {
  if (error instanceof z.ZodError) {
    return failure(requestId, 400, {
      code: 'invalid_input',
      message: 'The Portreeve request is invalid.',
      retryable: false,
      details: { issues: error.issues },
    });
  }
  if (error instanceof RegistryError) {
    const status =
      error.code === 'not_found'
        ? 404
        : error.code === 'conflict' ||
            error.code === 'lease_expired' ||
            error.code === 'lease_not_pending'
          ? 409
          : error.code === 'incompatible_protocol'
            ? 426
            : 400;
    return failure(requestId, status, {
      code: error.code,
      message: error.message,
      retryable: error.code === 'conflict',
      details: error.details,
    });
  }

  console.error(error);
  return failure(requestId, 500, {
    code: 'internal',
    message: 'Portreeve encountered an internal error.',
    retryable: false,
    details: {},
  });
}

/**
 * @param {string} requestId
 * @param {number} status
 * @param {unknown} body
 */
function failure(requestId, status, body) {
  return Response.json(
    ErrorEnvelopeSchema.parse({
      protocolVersion: 1,
      requestId,
      error: body,
    }),
    { status },
  );
}

/**
 * @param {Request} request
 */
function requestIdFor(request) {
  const candidate = request.headers.get('x-portreeve-request-id');
  const parsed = IdentifierSchema.safeParse(candidate);
  return parsed.success ? parsed.data : randomUUID();
}

/**
 * @param {unknown} body
 */
function objectBody(body) {
  return z.record(z.string(), z.unknown()).parse(body);
}

/**
 * @param {URL} url
 */
function inventoryFilters(url) {
  /** @type {{
   *   classification?: string,
   *   claimed?: boolean,
   *   listening?: boolean,
   *   project?: string,
   *   workspace?: string,
   *   service?: string,
   *   component?: string,
   *   endpoint?: string,
   *   port?: number
   * }} */
  const filters = {};
  const classification = url.searchParams.get('classification');
  const project = url.searchParams.get('project');
  const workspace = url.searchParams.get('workspace');
  const service = url.searchParams.get('service');
  const component = url.searchParams.get('component');
  const endpoint = url.searchParams.get('endpoint');
  const port = url.searchParams.get('port');
  if (classification !== null) {
    filters.classification = InventoryClassificationSchema.parse(classification);
  }
  if (url.searchParams.has('claimed')) {
    filters.claimed =
      z.enum(['true', 'false']).parse(url.searchParams.get('claimed')) === 'true';
  }
  if (url.searchParams.has('listening')) {
    filters.listening =
      z.enum(['true', 'false']).parse(url.searchParams.get('listening')) === 'true';
  }
  if (project !== null) {
    filters.project = project;
  }
  if (workspace !== null) {
    filters.workspace = workspace;
  }
  if (service !== null) {
    filters.service = service;
  }
  if (component !== null) {
    filters.component = component;
  }
  if (endpoint !== null) {
    filters.endpoint = endpoint;
  }
  if (port !== null) {
    filters.port = PortSchema.parse(Number.parseInt(port, 10));
  }
  return filters;
}

/**
 * @param {URL} url
 */
function historyFilters(url) {
  const eventType = url.searchParams.get('eventType');
  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');
  const since = url.searchParams.get('since');
  return {
    limit: queryLimit(url, 100),
    ...(eventType === null ? {} : { eventType }),
    ...(entityType === null ? {} : { entityType }),
    ...(entityId === null ? {} : { entityId }),
    ...(since === null ? {} : { since }),
  };
}

/**
 * @param {URL} url
 * @param {number} fallback
 */
function queryLimit(url, fallback) {
  const value = url.searchParams.get('limit');
  return value === null
    ? fallback
    : z.number().int().min(1).max(10_000).parse(Number(value));
}

/**
 * @param {{protocol: {minimum: number, maximum: number}, requiredCapabilities: string[]}} client
 */
function assertCompatible(client) {
  const result = negotiateCompatibility(client.protocol, client.requiredCapabilities);
  if (!result.compatible) {
    throw new RegistryError(
      'incompatible_protocol',
      'Client and server protocol capabilities are incompatible.',
      result,
    );
  }
}

/**
 * Diagnostics are intentionally best effort after startup. Audit history
 * remains transactional; a full log disk must not replace a protocol result.
 *
 * @param {import('../observability/diagnostic-log.js').DiagnosticLog | undefined} diagnosticLog
 * @param {'debug' | 'info' | 'warn' | 'error'} level
 * @param {string} component
 * @param {string} message
 * @param {Record<string, unknown>} details
 */
function writeDiagnostic(diagnosticLog, level, component, message, details) {
  try {
    diagnosticLog?.write(level, component, message, details);
  } catch (error) {
    console.error(
      `Portreeve diagnostic logging failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * @param {string} socketPath
 */
async function removeStaleSocket(socketPath) {
  let information;
  try {
    information = await lstat(socketPath);
  } catch (error) {
    if (isMissingFile(error)) {
      return;
    }
    throw error;
  }

  if (!information.isSocket()) {
    throw new Error(`Refusing to replace non-socket path: ${socketPath}`);
  }
  if (typeof process.getuid === 'function' && information.uid !== process.getuid()) {
    throw new Error(`Refusing to replace socket owned by another user: ${socketPath}`);
  }

  if (await socketAcceptsConnections(socketPath)) {
    throw new Error(`A server is already serving on ${socketPath}`);
  }

  await unlink(socketPath);
}

/**
 * @param {string} socketPath
 */
function socketAcceptsConnections(socketPath) {
  return new Promise((resolvePromise, reject) => {
    const socket = createConnection(socketPath);
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolvePromise(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error(`Timed out inspecting active socket ${socketPath}`));
    });
    socket.once('error', (error) => {
      socket.destroy();
      if (
        'code' in error &&
        (error.code === 'ECONNREFUSED' || error.code === 'ENOENT')
      ) {
        resolvePromise(false);
        return;
      }
      reject(error);
    });
  });
}

/**
 * @param {unknown} error
 */
function isMissingFile(error) {
  return (
    error instanceof Error &&
    'code' in error &&
    /** @type {{code?: string}} */ (error).code === 'ENOENT'
  );
}
