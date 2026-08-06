// @ts-check

import { expect, test } from 'bun:test';
import { openRegistry, RegistryError } from '../../src/storage/registry.js';
import { StackDefinitionService } from '../../src/stacks/service.js';

const now = new Date('2026-08-06T12:00:00.000Z');
const client = {
  softwareVersion: '0.1.0',
  protocol: { minimum: 1, maximum: 1 },
  requiredCapabilities: ['stack-definitions-v1'],
};

/** @param {number | undefined} [exactPort] */
function definition(exactPort) {
  return {
    version: 1,
    project: 'caregiver',
    components: {
      api: {
        endpoints: {
          default: {
            allocation:
              exactPort === undefined ? { preferredPort: 43100 } : { exactPort },
          },
          internal: { publish: false },
        },
      },
      website: {
        endpoints: { default: {} },
        dependencies: { backend: { component: 'api' } },
      },
    },
  };
}

test('applies strict definitions idempotently and links published claims', () => {
  const registry = openRegistry();
  const service = new StackDefinitionService({ registry, now: () => now });
  const first = service.apply({
    client,
    workspaceRoot: '/worktrees/caregiver-a',
    definition: definition(),
  });
  const second = service.apply({
    client,
    workspaceRoot: '/worktrees/caregiver-a',
    definition: {
      ...definition(),
      components: {
        website: definition().components.website,
        api: definition().components.api,
      },
    },
  });

  expect(first.changed).toBe(true);
  expect(second.changed).toBe(false);
  expect(second.stack).toEqual(first.stack);
  expect(service.list()).toEqual([first.stack]);
  expect(service.get(first.stack.id)).toEqual(first.stack);
  expect(
    registry
      .listClaims()
      .map(({ identity }) => [identity.component, identity.endpoint]),
  ).toEqual([
    ['api', 'default'],
    ['website', 'default'],
  ]);
  expect(registry.listHistory().map(({ eventType }) => eventType)).toEqual([
    'claim.created',
    'claim.created',
    'stack.created',
  ]);
  registry.close();
});

test('reuses legacy assignments and rejects a conflicting exact revision atomically', () => {
  const registry = openRegistry();
  const claim = registry.insertClaim(
    {
      identity: {
        project: 'caregiver',
        workspaceRoot: '/worktrees/caregiver-a',
        service: 'api',
        transport: 'tcp',
      },
      mode: 'sticky',
    },
    now,
  );
  registry.reassignClaim({ claimId: claim.id, port: 43100 }, now);
  const service = new StackDefinitionService({ registry, now: () => now });
  const applied = service.apply({
    client,
    workspaceRoot: '/worktrees/caregiver-a',
    definition: definition(43100),
  });

  expect(
    registry.findClaim({
      project: 'caregiver',
      workspaceRoot: '/worktrees/caregiver-a',
      component: 'api',
      endpoint: 'default',
      transport: 'tcp',
    })?.id,
  ).toBe(claim.id);
  expect(() =>
    service.apply({
      client,
      workspaceRoot: '/worktrees/caregiver-a',
      definition: definition(43101),
    }),
  ).toThrow(RegistryError);
  expect(service.get(applied.stack.id).currentRevision).toBe(
    applied.stack.currentRevision,
  );
  registry.close();
});

test('preserves assignments and immutable prior content across changed revisions', () => {
  const registry = openRegistry();
  const claim = registry.insertClaim(
    {
      identity: {
        project: 'caregiver',
        workspaceRoot: '/worktrees/caregiver-a',
        component: 'api',
        transport: 'tcp',
      },
      mode: 'sticky',
    },
    now,
  );
  registry.reassignClaim({ claimId: claim.id, port: 43100 }, now);
  const service = new StackDefinitionService({ registry, now: () => now });
  const first = service.apply({
    client,
    workspaceRoot: '/worktrees/caregiver-a',
    definition: definition(43100),
  });
  const changedDefinition = definition(43100);
  const website = changedDefinition.components.website;
  if (!website) {
    throw new Error('Expected website component');
  }
  /** @type {any} */ (website.endpoints.default).required = false;
  const second = service.apply({
    client,
    workspaceRoot: '/worktrees/caregiver-a',
    definition: changedDefinition,
  });

  expect(second.changed).toBe(true);
  expect(second.stack.id).toBe(first.stack.id);
  expect(second.stack.currentRevision).not.toBe(first.stack.currentRevision);
  expect(registry.getClaim(claim.id)?.assignedPort).toBe(43100);
  expect(
    registry.database
      .query(
        'SELECT COUNT(*) AS count FROM stack_definition_revisions WHERE stack_id = $stackId',
      )
      .get({ stackId: first.stack.id }),
  ).toEqual({ count: 2 });
  expect(registry.listHistory().at(-1)?.eventType).toBe('stack.definition.applied');
  registry.close();
});

test('requires the definition capability before mutation', () => {
  const registry = openRegistry();
  const service = new StackDefinitionService({ registry, now: () => now });
  expect(() =>
    service.apply({
      client: { ...client, requiredCapabilities: ['future-stack-v2'] },
      workspaceRoot: '/worktrees/caregiver-a',
      definition: definition(),
    }),
  ).toThrow('requirements do not overlap');
  expect(service.list()).toEqual([]);
  registry.close();
});
