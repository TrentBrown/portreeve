export declare const PORTREEVE_PROTOCOL_RANGE: Readonly<{
  minimum: 1;
  maximum: 1;
}>;

export interface ClaimIdentity {
  project: string;
  workspaceRoot: string;
  service: string;
  transport?: 'tcp';
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
    | 'mixed';
  claim: Record<string, unknown> | null;
  lease: Record<string, unknown> | null;
  run: Record<string, unknown> | null;
  listeners: Array<Record<string, unknown>>;
}

export interface ClaimRecord {
  id: string;
  identity: Required<ClaimIdentity>;
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
  outcome: 'already-free' | 'would-terminate' | 'terminated' | 'refused' | 'timeout';
  reason: string | null;
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
    port?: number;
  }): Promise<InventoryEntry[]>;
  inspectPort(port: number): Promise<InventoryEntry>;
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
export declare function canonicalWorkspaceRoot(projectPath: string): Promise<string>;
