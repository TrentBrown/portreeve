// @ts-check

import { describe, expect, test } from 'bun:test';
import {
  AcquireRequestSchema,
  ConfigSetRequestSchema,
  HealthResponseSchema,
  PORTREEVE_HEALTH,
  StackBeginActivationRequestSchema,
  StackRenewActivationRequestSchema,
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
    });
    expect(() =>
      StackRenewActivationRequestSchema.parse({
        client,
        leases: [],
      }),
    ).toThrow();
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
