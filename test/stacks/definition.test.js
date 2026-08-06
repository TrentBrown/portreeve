// @ts-check

import { expect, test } from 'bun:test';
import { StackDefinitionSchema } from '../../src/protocol/schemas.js';
import { normalizeStackDefinition } from '../../src/stacks/definition.js';

function definition() {
  return {
    version: 1,
    project: 'caregiver',
    components: {
      website: {
        dependencies: {
          backend: { component: 'api', endpoint: 'http' },
        },
        endpoints: {
          http: { allocation: { preferredPort: 3000 } },
        },
      },
      api: {
        docker: { service: 'api' },
        endpoints: {
          http: {
            allocation: { preferredPort: 8080 },
            docker: { containerPort: 8080 },
          },
        },
      },
    },
  };
}

test('normalizes defaults and hashes definitions independently of key order', () => {
  const first = normalizeStackDefinition(definition());
  const source = definition();
  const second = normalizeStackDefinition({
    components: { api: source.components.api, website: source.components.website },
    project: source.project,
    version: source.version,
  });

  expect(first.revision).toBe(second.revision);
  const website = first.definition.components.website;
  if (!website) {
    throw new Error('Expected website component');
  }
  expect(website.endpoints.http).toMatchObject({
    transport: 'tcp',
    publish: true,
    required: true,
  });
  expect(website.dependencies.backend).toMatchObject({
    endpoint: 'http',
    required: true,
  });
});

test('rejects unknown fields and broken dependency or Docker references', () => {
  expect(() =>
    StackDefinitionSchema.parse({ ...definition(), command: 'bun run start' }),
  ).toThrow();

  const missingDependency = definition();
  const website = missingDependency.components.website;
  if (!website) {
    throw new Error('Expected website component');
  }
  website.dependencies.backend.component = 'missing';
  expect(() => StackDefinitionSchema.parse(missingDependency)).toThrow(
    'unknown component',
  );

  const missingDockerService = definition();
  const api = missingDockerService.components.api;
  if (!api) {
    throw new Error('Expected api component');
  }
  delete (/** @type {any} */ (api).docker);
  expect(() => StackDefinitionSchema.parse(missingDockerService)).toThrow(
    'has no Docker service',
  );

  const contradictoryAllocation = definition();
  const http = contradictoryAllocation.components.api?.endpoints.http;
  if (!http) {
    throw new Error('Expected api HTTP endpoint');
  }
  http.allocation = /** @type {any} */ ({
    preferredPort: 8080,
    exactPort: 8080,
  });
  expect(() => StackDefinitionSchema.parse(contradictoryAllocation)).toThrow(
    'mutually exclusive',
  );

  const missingEndpoint = definition();
  const missingEndpointWebsite = missingEndpoint.components.website;
  if (!missingEndpointWebsite) {
    throw new Error('Expected website component');
  }
  missingEndpointWebsite.dependencies.backend.endpoint = 'missing';
  expect(() => StackDefinitionSchema.parse(missingEndpoint)).toThrow(
    'unknown endpoint',
  );

  expect(() =>
    StackDefinitionSchema.parse({
      version: 1,
      project: 'caregiver',
      components: { api: {}, ' api ': {} },
    }),
  ).toThrow('must not begin or end with whitespace');
});
