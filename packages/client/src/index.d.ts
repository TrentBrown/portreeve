export declare const PORTREEVE_PROTOCOL_RANGE: Readonly<{
  minimum: 1;
  maximum: 1;
}>;

export interface ClaimIdentityBase {
  project: string;
  workspaceRoot: string;
  endpoint?: string;
  transport?: 'tcp';
}

export type ClaimIdentity = ClaimIdentityBase &
  ({ service: string; component?: string } | { component: string; service?: string });

export interface CanonicalClaimIdentity {
  project: string;
  workspaceRoot: string;
  service: string;
  component: string;
  endpoint: string;
  transport: 'tcp';
}

export interface AcquireOptions {
  claim: ClaimIdentity;
  allocation?: {
    mode?: 'sticky' | 'ephemeral';
    preferredPort?: number;
    exactPort?: number;
    replacementPolicy?: 'never' | 'graceful' | 'force-after-grace';
  };
}

export interface HealthResult {
  softwareVersion: string;
  protocol: { minimum: number; maximum: number };
  capabilities: readonly string[];
  pid: number;
  mode: 'manual' | 'supervised';
}

export interface AcquireResult {
  claimId: string;
  leaseId: string;
  leaseToken: string;
  port: number;
  expiresAt: string;
  reusedAssignment: boolean;
}

export interface ConfirmResult {
  claimId: string;
  leaseId: string;
  runId: string;
  port: number;
  confirmedAt: string;
}

export interface MutationAcknowledgement {
  changed: boolean;
  at: string;
}

export interface InventoryEntry {
  port: number;
  transport: 'tcp';
  classification:
    | 'available'
    | 'verified'
    | 'idle'
    | 'pending'
    | 'unclaimed'
    | 'conflicting'
    | 'mixed'
    | 'docker-managed';
  claim: Record<string, unknown> | null;
  lease: Record<string, unknown> | null;
  run: Record<string, unknown> | null;
  docker: {
    available: boolean;
    reason: string | null;
    containers: Array<{
      id: string;
      running: boolean;
      labels: Record<string, string>;
      ports: Array<{ containerPort: number; hostIp: string; hostPort: number }>;
    }>;
  } | null;
  listeners: Array<Record<string, unknown>>;
}

export interface ClaimRecord {
  id: string;
  identity: CanonicalClaimIdentity;
  mode: 'sticky' | 'ephemeral';
  assignedPort: number | null;
  preferredPort: number | null;
  exactPort: number | null;
  assignmentExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
}

export interface ClaimPruneResult {
  dryRun: boolean;
  candidates: Array<{
    claim: ClaimRecord;
    reason: 'workspace-missing';
  }>;
  deletedClaimIds: string[];
  skipped: Array<{ claimId: string; reason: string }>;
}

export interface StackAllocationDefinition {
  preferredPort?: number;
  exactPort?: number;
}

export interface StackEndpointDefinition {
  transport?: 'tcp';
  publish?: boolean;
  required?: boolean;
  allocation?: StackAllocationDefinition;
  docker?: { containerPort: number };
}

export interface StackDependencyDefinition {
  component: string;
  endpoint?: string;
  required?: boolean;
}

export interface StackComponentDefinition {
  endpoints?: Record<string, StackEndpointDefinition>;
  dependencies?: Record<string, StackDependencyDefinition>;
  docker?: { service: string };
}

export interface StackDefinition {
  version: 1;
  project: string;
  components: Record<string, StackComponentDefinition>;
}

export interface StackRecord {
  id: string;
  project: string;
  stackRoot: string;
  currentRevision: string;
  definition: StackDefinition;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
}

export interface StackApplyResult {
  changed: boolean;
  stack: StackRecord;
}

export interface StackEndpointReference {
  component: string;
  endpoint?: string;
}

export interface StackGenerationEndpoint {
  claimId: string;
  component: string;
  endpoint: string;
  transport: 'tcp';
  host: '127.0.0.1';
  port: number;
  required: boolean;
}

export interface StackGeneration {
  id: string;
  stackId: string;
  revision: string;
  state: 'valid' | 'stale';
  endpoints: StackGenerationEndpoint[];
  createdAt: string;
  invalidatedAt: string | null;
}

export interface StackActivationEndpoint {
  component: string;
  endpoint: string;
  claimId: string;
  port: number;
  required: boolean;
  bindingKind: 'process' | 'docker';
  state: 'leased' | 'confirmed' | 'skipped' | 'failed' | 'released';
  leaseId: string | null;
  runId: string | null;
  expiresAt: string | null;
  failureReason: string | null;
  updatedAt: string;
}

export interface StackActivation {
  id: string;
  stackId: string;
  generationId: string;
  state: 'starting' | 'confirmed' | 'degraded' | 'failed' | 'lost' | 'ended';
  endpoints: StackActivationEndpoint[];
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  endedAt: string | null;
}

export interface StackProviderEvidence {
  component: string;
  endpoint: string;
  port: number;
  bindingKind: 'process' | 'docker';
  status: 'active' | 'gone' | 'unknown';
  reason: string;
  listeners: number;
  runId: string | null;
  containerId: string | null;
}

export interface StackReconcileResult {
  changed: boolean;
  activation: StackActivation;
  providers: StackProviderEvidence[];
}

export interface StackStatus {
  stack: StackRecord;
  generation: StackGeneration | null;
  activation: StackActivation | null;
  providers: StackProviderEvidence[];
}

export interface StackPruneResult {
  dryRun: boolean;
  candidates: Array<{
    stack: StackRecord;
    claimIds: string[];
    reason: 'stack-root-missing';
  }>;
  blocked: Array<{ stack: StackRecord; reasons: string[] }>;
  deletedStackIds: string[];
  deletedClaimIds: string[];
  skipped: Array<{ stackId: string; reason: string }>;
}

export interface StackActivationLease {
  component: string;
  endpoint: string;
  leaseId: string;
  leaseToken: string;
  port: number;
  expiresAt: string;
  bindingKind: 'process' | 'docker';
  docker: {
    service: string;
    containerPort: number;
    requiredLabels: Record<string, string>;
  } | null;
}

export interface StackBeginActivationResult {
  activation: StackActivation;
  leases: StackActivationLease[];
}

export interface StackAddress {
  transport: 'tcp';
  host: string;
  port: number;
}

export interface StackResolvedEndpoint {
  component: string;
  endpoint: string;
  host: StackAddress;
  dockerNetwork: StackAddress | null;
}

export interface StackResolution {
  schemaVersion: 1;
  definitionRevision: string;
  generationId: string;
  activationId: string;
  component: string;
  own: Record<string, StackResolvedEndpoint>;
  dependencies: Record<string, StackResolvedEndpoint>;
}

export interface StackSnapshotEndpoint {
  component: string;
  endpoint: string;
  address: StackAddress;
}

export interface StackEndpointSnapshot {
  schemaVersion: 1;
  definitionRevision: string;
  generationId: string;
  activationId: string;
  component: string;
  own: Record<string, StackSnapshotEndpoint>;
  dependencies: Record<string, StackSnapshotEndpoint>;
}

export interface HistoryEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface DiagnosticLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  details: Record<string, unknown>;
}

export interface ReclamationResult {
  operationId: string;
  operation: 'reclaim' | 'unsafe-eviction';
  port: number;
  policy: 'never' | 'graceful' | 'force-after-grace';
  dryRun: boolean;
  outcome:
    | 'already-free'
    | 'would-terminate'
    | 'terminated'
    | 'refused'
    | 'timeout'
    | 'launcher-action-required';
  reason: string | null;
  launcherAction: {
    kind: 'docker';
    action: 'stop-container';
    containerIds: string[];
  } | null;
  targets: Array<Record<string, unknown>>;
  signals: Array<{
    pid: number;
    signal: 'SIGTERM' | 'SIGKILL';
    at: string;
  }>;
}

export declare class PortreeveClientError extends Error {
  constructor(
    message: string,
    options: {
      code: string;
      status?: number;
      requestId?: string;
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  );
  code: string;
  status?: number;
  requestId?: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

export declare class PortreeveClient {
  constructor(options?: { socketPath?: string });
  readonly socketPath: string;
  health(): Promise<HealthResult>;
  stopServer(): Promise<MutationAcknowledgement>;
  listPorts(filters?: {
    classification?: InventoryEntry['classification'];
    claimed?: boolean;
    listening?: boolean;
    project?: string;
    workspace?: string;
    service?: string;
    component?: string;
    endpoint?: string;
    port?: number;
  }): Promise<InventoryEntry[]>;
  inspectPort(port: number): Promise<InventoryEntry>;
  applyStack(request: {
    stackRoot: string;
    definition: StackDefinition;
  }): Promise<StackApplyResult>;
  listStacks(filters?: {
    project?: string;
    stackRoot?: string;
  }): Promise<StackRecord[]>;
  getStack(stackId: string): Promise<StackRecord>;
  getStackStatus(stackId: string): Promise<StackStatus>;
  prepareStack(stackId: string): Promise<{
    reused: boolean;
    generation: StackGeneration;
  }>;
  beginStackActivation(
    generationId: string,
    options?: {
      requiredEndpoints?: StackEndpointReference[];
      skippedEndpoints?: StackEndpointReference[];
      bindings?: Record<string, 'process' | 'docker'>;
    },
  ): Promise<StackBeginActivationResult>;
  getStackActivation(activationId: string): Promise<StackActivation>;
  getStackGeneration(generationId: string): Promise<StackGeneration>;
  renewStackActivation(
    activationId: string,
    leases: Array<{ leaseId: string; leaseToken: string }>,
  ): Promise<{
    activation: StackActivation;
    leases: Array<{ leaseId: string; expiresAt: string }>;
  }>;
  confirmStackEndpoint(
    activationId: string,
    evidence:
      | {
          leaseId: string;
          leaseToken: string;
          bindingKind?: 'process';
          rootPid: number;
        }
      | {
          leaseId: string;
          leaseToken: string;
          bindingKind: 'docker';
          containerId: string;
        },
  ): Promise<StackActivation>;
  abandonStackEndpoint(
    activationId: string,
    evidence: {
      leaseId: string;
      leaseToken: string;
      reason: 'address-in-use' | 'startup-error' | 'client-cancelled';
    },
  ): Promise<StackActivation>;
  skipStackEndpoint(
    activationId: string,
    evidence: { leaseId: string; leaseToken: string },
  ): Promise<StackActivation>;
  endStackActivation(activationId: string): Promise<{
    changed: boolean;
    activation: StackActivation;
  }>;
  reconcileStackActivation(activationId: string): Promise<StackReconcileResult>;
  pruneStacks(options: {
    olderThanMilliseconds: number;
    dryRun: boolean;
  }): Promise<StackPruneResult>;
  resolveStackEndpoints(
    activationId: string,
    component: string,
  ): Promise<StackResolution>;
  createStackEndpointSnapshot(
    activationId: string,
    options: { component: string; gatewayHost: string },
  ): Promise<StackEndpointSnapshot>;
  listClaims(): Promise<ClaimRecord[]>;
  getClaim(claimId: string): Promise<ClaimRecord>;
  reassignClaim(
    claimId: string,
    options?: { preferredPort?: number; exactPort?: number },
  ): Promise<ClaimRecord>;
  deleteClaim(claimId: string): Promise<MutationAcknowledgement>;
  pruneClaims(options: {
    olderThanMilliseconds: number;
    dryRun: boolean;
  }): Promise<ClaimPruneResult>;
  getConfig(): Promise<Record<string, unknown>>;
  setConfig(updates: Record<string, unknown>): Promise<Record<string, unknown>>;
  history(filters?: {
    limit?: number;
    eventType?: string;
    entityType?: string;
    entityId?: string;
    since?: string;
  }): Promise<HistoryEvent[]>;
  logs(options?: { limit?: number }): Promise<DiagnosticLogEntry[]>;
  reclaimPort(
    port: number,
    options: {
      policy: 'never' | 'graceful' | 'force-after-grace';
      dryRun?: boolean;
    },
  ): Promise<ReclamationResult>;
  unsafeEvictPort(
    port: number,
    options: {
      unsafeAnyOwner: true;
      policy?: 'graceful' | 'force-after-grace';
      dryRun?: boolean;
    },
  ): Promise<ReclamationResult>;
  acquire(request: AcquireOptions): Promise<AcquireResult>;
  confirm(
    lease: { leaseId: string; leaseToken: string },
    options?: { rootPid?: number },
  ): Promise<ConfirmResult>;
  abandon(
    lease: { leaseId: string; leaseToken: string },
    reason: 'address-in-use' | 'startup-error' | 'client-cancelled',
  ): Promise<MutationAcknowledgement>;
  release(runId: string): Promise<MutationAcknowledgement>;
  withPort<T>(
    request: AcquireOptions & { maxAttempts?: number; rootPid?: number },
    start: (port: number) => Promise<T>,
  ): Promise<{
    readonly port: number;
    readonly run: ConfirmResult;
    readonly value: T;
    release(): Promise<MutationAcknowledgement>;
  }>;
}

export declare function defaultSocketPath(): string;
export declare function canonicalStackRoot(stackPath: string): Promise<string>;
export declare function canonicalWorkspaceRoot(projectPath: string): Promise<string>;
export declare function parseEndpointSnapshot(input: unknown): StackEndpointSnapshot;
export declare function readEndpointSnapshot(
  filename?: string,
  expected?: {
    definitionRevision?: string;
    generationId?: string;
    activationId?: string;
    component?: string;
  },
): Promise<StackEndpointSnapshot>;
export declare function writeEndpointSnapshot(
  filename: string,
  snapshot: StackEndpointSnapshot,
): Promise<string>;
