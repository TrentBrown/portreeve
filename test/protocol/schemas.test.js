// @ts-check

import { describe, expect, test } from 'bun:test';
import {
  AcquireRequestSchema,
  ConfigSetRequestSchema,
  HealthResponseSchema,
  LauncherOperationBeginRequestSchema,
  LauncherOperationCompleteRequestSchema,
  PORTREEVE_HEALTH,
  ReclamationResultSchema,
  StackBeginActivationRequestSchema,
  StackConfirmEndpointRequestSchema,
  StackDefinitionSchema,
  StackApplyRequestSchema,
  StackRenewActivationRequestSchema,
  StackSnapshotRequestSchema,
  UnsafeEvictionRequestSchema,
  negotiateCompatibility,
  successEnvelopeSchema,
} from '../../src/protocol/schemas.js';

const client = {
  softwareVersion: '1.0.0',
  protocol: { minimum: 1, maximum: 1 },
  requiredCapabilities: ['two-phase-allocation-v1'],
};

const claim = {
  project: 'caregiver',
  workspaceRoot: '/worktrees/caregiver-a',
  service: 'website',
  transport: 'tcp',
};

describe('protocol schemas', () => {
  test('health advertises the supported protocol and capabilities', () => {
    expect(HealthResponseSchema.parse(PORTREEVE_HEALTH)).toEqual(PORTREEVE_HEALTH);
  });

  test('accepts a valid exact-port acquisition request', () => {
    const request = AcquireRequestSchema.parse({
      client,
      claim,
      allocation: {
        exactPort: 43100,
        mode: 'sticky',
        replacementPolicy: 'never',
      },
    });

    expect(request.allocation.exactPort).toBe(43100);
    expect(request.claim).toEqual({
      project: 'caregiver',
      workspaceRoot: '/worktrees/caregiver-a',
      service: 'website',
      component: 'website',
      endpoint: 'default',
      transport: 'tcp',
    });
  });

  test('accepts component endpoints and rejects conflicting service aliases', () => {
    expect(
      AcquireRequestSchema.parse({
        client,
        claim: {
          project: 'caregiver',
          workspaceRoot: '/worktrees/caregiver-a',
          component: 'api',
          endpoint: 'metrics',
          transport: 'tcp',
        },
        allocation: {},
      }).claim,
    ).toMatchObject({
      service: 'api',
      component: 'api',
      endpoint: 'metrics',
    });

    expect(() =>
      AcquireRequestSchema.parse({
        client,
        claim: {
          project: 'caregiver',
          workspaceRoot: '/worktrees/caregiver-a',
          service: 'website',
          component: 'api',
          transport: 'tcp',
        },
        allocation: {},
      }),
    ).toThrow('must match');
  });

  test('rejects preferred and exact ports in the same request', () => {
    expect(() =>
      AcquireRequestSchema.parse({
        client,
        claim,
        allocation: {
          preferredPort: 43100,
          exactPort: 43101,
        },
      }),
    ).toThrow('mutually exclusive');
  });

  test('requires operation-scoped unsafe eviction consent', () => {
    expect(() =>
      UnsafeEvictionRequestSchema.parse({
        client,
        policy: 'force-after-grace',
        dryRun: true,
      }),
    ).toThrow();
    expect(
      UnsafeEvictionRequestSchema.parse({
        client,
        unsafeAnyOwner: true,
        policy: 'force-after-grace',
        dryRun: true,
      }),
    ).toMatchObject({
      unsafeAnyOwner: true,
      policy: 'force-after-grace',
      dryRun: true,
    });
  });

  test('normalizes activation endpoint shorthand and validates renewal credentials', () => {
    const generationId = crypto.randomUUID();
    expect(
      StackBeginActivationRequestSchema.parse({
        client,
        generationId,
        requiredEndpoints: [{ component: 'api' }],
        skippedEndpoints: [{ component: 'api', endpoint: 'metrics' }],
      }),
    ).toMatchObject({
      generationId,
      requiredEndpoints: [{ component: 'api', endpoint: 'default' }],
      skippedEndpoints: [{ component: 'api', endpoint: 'metrics' }],
      bindings: {},
    });
    expect(() =>
      StackRenewActivationRequestSchema.parse({
        client,
        leases: [],
      }),
    ).toThrow();
  });

  test('uses stackRoot for stack definitions without changing claim workspaceRoot', () => {
    const definition = StackDefinitionSchema.parse({
      version: 1,
      project: 'caregiver',
      components: { api: { endpoints: { default: {} } } },
    });
    expect(
      StackApplyRequestSchema.parse({
        client,
        stackRoot: '/stacks/caregiver',
        definition,
      }),
    ).toMatchObject({ stackRoot: '/stacks/caregiver' });
    expect(() =>
      StackApplyRequestSchema.parse({
        client,
        workspaceRoot: '/worktrees/caregiver',
        definition,
      }),
    ).toThrow();
    expect(() =>
      StackApplyRequestSchema.parse({
        client,
        stackRoot: '/stacks/caregiver',
        workspaceRoot: '/worktrees/caregiver',
        definition,
      }),
    ).toThrow();
  });

  test('distinguishes process and Docker activation confirmations', () => {
    const leaseId = crypto.randomUUID();
    const leaseToken = 't'.repeat(43);
    expect(
      StackConfirmEndpointRequestSchema.parse({
        client,
        leaseId,
        leaseToken,
        rootPid: 42,
      }),
    ).toMatchObject({ bindingKind: 'process', rootPid: 42 });
    expect(
      StackConfirmEndpointRequestSchema.parse({
        client,
        leaseId,
        leaseToken,
        bindingKind: 'docker',
        containerId: 'a'.repeat(64),
      }),
    ).toMatchObject({ bindingKind: 'docker', containerId: 'a'.repeat(64) });
    expect(() =>
      StackConfirmEndpointRequestSchema.parse({
        client,
        leaseId,
        leaseToken,
        bindingKind: 'docker',
        rootPid: 42,
      }),
    ).toThrow();
  });

  test('accepts a structured launcher action for Docker reclamation', () => {
    expect(
      ReclamationResultSchema.parse({
        operationId: crypto.randomUUID(),
        operation: 'reclaim',
        port: 43210,
        policy: 'graceful',
        dryRun: false,
        outcome: 'launcher-action-required',
        reason: 'docker-managed-listener',
        launcherAction: {
          kind: 'docker',
          action: 'stop-container',
          containerIds: ['b'.repeat(64)],
        },
        targets: [],
        signals: [],
      }),
    ).toMatchObject({ outcome: 'launcher-action-required' });
  });

  test('rejects unpublished dependency targets and unsafe sandbox gateway hosts', () => {
    expect(() =>
      StackDefinitionSchema.parse({
        version: 1,
        project: 'caregiver',
        components: {
          api: { endpoints: { private: { publish: false } } },
          website: {
            dependencies: { backend: { component: 'api', endpoint: 'private' } },
          },
        },
      }),
    ).toThrow('references unpublished endpoint');
    expect(() =>
      StackSnapshotRequestSchema.parse({
        client,
        component: 'website',
        gatewayHost: 'host.docker.internal/path',
      }),
    ).toThrow('must not contain whitespace or slashes');
  });

  test('keeps configuration updates on the explicit settings contract', () => {
    expect(
      ConfigSetRequestSchema.parse({
        client,
        updates: { gracefulShutdownMilliseconds: 1_000 },
      }),
    ).toMatchObject({
      updates: { gracefulShutdownMilliseconds: 1_000 },
    });
    expect(() =>
      ConfigSetRequestSchema.parse({
        client,
        updates: { unknownSetting: true },
      }),
    ).toThrow();
  });

  test('keeps launcher coordination strict and excludes executable data', () => {
    const stackId = crypto.randomUUID();
    expect(
      LauncherOperationBeginRequestSchema.parse({
        client,
        stackId,
        operation: 'start',
        launcherRevision: 'a'.repeat(64),
        callerOperationId: crypto.randomUUID(),
      }),
    ).toMatchObject({
      stackId,
      operation: 'start',
      executionMode: 'finite',
      generationId: null,
    });
    expect(() =>
      LauncherOperationBeginRequestSchema.parse({
        client,
        stackId,
        operation: 'stop',
        executionMode: 'attached',
        launcherRevision: 'a'.repeat(64),
        callerOperationId: crypto.randomUUID(),
      }),
    ).toThrow('available only for Start');
    expect(() =>
      LauncherOperationBeginRequestSchema.parse({
        client,
        stackId,
        operation: 'start',
        launcherRevision: 'a'.repeat(64),
        callerOperationId: crypto.randomUUID(),
        command: 'npm start',
      }),
    ).toThrow();
    expect(() =>
      LauncherOperationCompleteRequestSchema.parse({
        client,
        credential: 't'.repeat(43),
        completion: {
          outcome: 'failed',
          failure: {
            step: 'execute',
            code: 'command_failed',
            message: 'The command exited unsuccessfully.',
          },
          environment: { SECRET: 'not allowed' },
          rawOutput: 'not allowed',
        },
      }),
    ).toThrow();
    const generationId = crypto.randomUUID();
    const activationId = crypto.randomUUID();
    expect(
      LauncherOperationCompleteRequestSchema.parse({
        client,
        credential: 't'.repeat(43),
        completion: {
          outcome: 'succeeded',
          integration: {
            mode: 'command-only',
            verified: true,
            upgradeSuggested: true,
            generationId,
            activationId,
          },
        },
      }).completion.integration,
    ).toEqual({
      mode: 'command-only',
      verified: true,
      upgradeSuggested: true,
      generationId,
      activationId,
    });
    expect(() =>
      LauncherOperationCompleteRequestSchema.parse({
        client,
        credential: 't'.repeat(43),
        completion: {
          outcome: 'succeeded',
          integration: {
            mode: 'verified-activation',
            verified: false,
            upgradeSuggested: true,
            generationId: null,
            activationId: null,
          },
        },
      }),
    ).toThrow();
  });

  test('negotiates overlap and reports missing capabilities', () => {
    expect(
      negotiateCompatibility({ minimum: 1, maximum: 2 }, ['two-phase-allocation-v1']),
    ).toEqual({
      compatible: true,
      negotiatedProtocol: 1,
      missingCapabilities: [],
    });

    expect(
      negotiateCompatibility({ minimum: 2, maximum: 3 }, ['future-capability']),
    ).toEqual({
      compatible: false,
      negotiatedProtocol: null,
      missingCapabilities: ['future-capability'],
    });
    expect(
      negotiateCompatibility(
        { minimum: 1, maximum: 1 },
        ['docker-evidence-v1'],
        ['docker-evidence-v1'],
      ),
    ).toMatchObject({ compatible: true, missingCapabilities: [] });
  });

  test('requires the stable protocol envelope', () => {
    const schema = successEnvelopeSchema(HealthResponseSchema);

    expect(() =>
      schema.parse({
        protocolVersion: 2,
        requestId: crypto.randomUUID(),
        data: PORTREEVE_HEALTH,
      }),
    ).toThrow();
  });
});
