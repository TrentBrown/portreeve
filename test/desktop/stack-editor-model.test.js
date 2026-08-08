// @ts-check

import { expect, test } from 'bun:test';
import {
  addDraftComponent,
  addDraftDependency,
  addDraftEndpoint,
  createEmptyStackDraft,
  deleteDraftTarget,
  draftDeletionImpact,
  evaluateStackDraft,
  loadStackDraft,
  serializeStackDraft,
  updateDraftComponent,
  updateDraftDependency,
  updateDraftEndpoint,
} from '../../apps/desktop/renderer/stack-editor-model.js';

test('new drafts infer only the project and expose progressive validation', () => {
  let draft = createEmptyStackDraft('customer-stack');
  const empty = evaluateStackDraft(draft);
  expect(empty).toMatchObject({
    valid: false,
    preview: null,
    previewCurrent: false,
    visibleIssues: [],
    firstInvalidControlId: null,
  });
  expect(empty.issues).toContainEqual(
    expect.objectContaining({ code: 'component_required', controlId: 'components' }),
  );
  expect(
    evaluateStackDraft(draft, { touched: ['components'] }).visibleIssues,
  ).toHaveLength(1);
  expect(evaluateStackDraft(draft, { submit: true }).firstInvalidControlId).toBe(
    'components',
  );

  const component = addDraftComponent(draft, { name: 'api' });
  draft = component.draft;
  const serialized = serializeStackDraft(draft);
  expect(serialized.content).toBe(`{
  "version": 1,
  "project": "customer-stack",
  "components": {
    "api": {}
  }
}\n`);
  expect(serialized.definition).toEqual({
    version: 1,
    project: 'customer-stack',
    components: { api: { endpoints: {}, dependencies: {} } },
  });
});

test('round-trips every variable field while omitting schema defaults', () => {
  const definition = fullDefinition();
  const draft = loadStackDraft(definition);
  const serialized = serializeStackDraft(draft);

  expect(serialized.definition).toEqual(definition);
  expect(serialized.content).toContain('"preferredPort": 4100');
  expect(serialized.content).toContain('"exactPort": 4200');
  expect(serialized.content).toContain('"containerPort": 3000');
  expect(serialized.content).toContain('"publish": false');
  expect(serialized.content).toContain('"required": false');
  expect(serialized.content).not.toContain('"transport"');
  expect(serialized.content).not.toContain('"publish": true');
  expect(serialized.content).not.toContain('"required": true');
  expect(serialized.content).not.toContain('"allocation": {}');
  expect(serialized.content).not.toContain('"endpoint": "default"');
  expect(JSON.parse(serialized.content)).toEqual({
    version: 1,
    project: 'customer',
    components: {
      api: {
        endpoints: {
          default: { allocation: { preferredPort: 4100 } },
          admin: {
            required: false,
            allocation: { exactPort: 4200 },
            docker: { containerPort: 3000 },
          },
          private: { publish: false },
        },
        docker: { service: 'api' },
      },
      website: {
        endpoints: { default: {} },
        dependencies: {
          backend: { component: 'api' },
          optionalAdmin: {
            component: 'api',
            endpoint: 'admin',
            required: false,
          },
        },
      },
    },
  });
});

test('stable identities cascade component and endpoint renames through dependencies', () => {
  let draft = loadStackDraft(fullDefinition());
  const api = draft.components.find(({ name }) => name === 'api');
  const website = draft.components.find(({ name }) => name === 'website');
  const defaultEndpoint = api?.endpoints.find(({ name }) => name === 'default');
  const backend = website?.dependencies.find(({ alias }) => alias === 'backend');
  if (
    api === undefined ||
    website === undefined ||
    defaultEndpoint === undefined ||
    backend === undefined
  ) {
    throw new Error('Expected complete draft fixtures.');
  }
  const originalTargetIds = {
    component: backend.targetComponentId,
    endpoint: backend.targetEndpointId,
  };

  draft = updateDraftComponent(draft, api.id, { name: 'backend' });
  draft = updateDraftEndpoint(draft, defaultEndpoint.id, { name: 'http' });
  const renamedBackend = draft.components
    .find(({ id }) => id === website.id)
    ?.dependencies.find(({ id }) => id === backend.id);
  expect(renamedBackend).toMatchObject({
    targetComponentId: originalTargetIds.component,
    targetEndpointId: originalTargetIds.endpoint,
  });
  expect(
    JSON.parse(serializeStackDraft(draft).content).components.website.dependencies
      .backend,
  ).toEqual({ component: 'backend', endpoint: 'http' });
});

test('referenced deletions require confirmation and cascade only after approval', () => {
  const original = loadStackDraft(fullDefinition());
  const api = original.components.find(({ name }) => name === 'api');
  const defaultEndpoint = api?.endpoints.find(({ name }) => name === 'default');
  if (api === undefined || defaultEndpoint === undefined) {
    throw new Error('Expected API draft fixtures.');
  }

  const endpointImpact = draftDeletionImpact(original, {
    kind: 'endpoint',
    id: defaultEndpoint.id,
  });
  expect(endpointImpact).toMatchObject({
    label: 'api.default',
    dependencies: [{ consumerComponentName: 'website', alias: 'backend' }],
  });
  const refused = deleteDraftTarget(original, {
    kind: 'endpoint',
    id: defaultEndpoint.id,
  });
  expect(refused).toMatchObject({
    draft: original,
    deleted: false,
    requiresConfirmation: true,
  });

  const deletedEndpoint = deleteDraftTarget(
    original,
    { kind: 'endpoint', id: defaultEndpoint.id },
    { cascade: true },
  );
  expect(deletedEndpoint.deleted).toBe(true);
  expect(
    deletedEndpoint.draft.components
      .find(({ name }) => name === 'website')
      ?.dependencies.map(({ alias }) => alias),
  ).toEqual(['optionalAdmin']);

  const componentImpact = draftDeletionImpact(original, {
    kind: 'component',
    id: api.id,
  });
  expect(componentImpact.dependencies.map(({ alias }) => alias)).toEqual([
    'backend',
    'optionalAdmin',
  ]);
  const deletedComponent = deleteDraftTarget(
    original,
    { kind: 'component', id: api.id },
    { cascade: true },
  );
  expect(deletedComponent.draft.components.map(({ name }) => name)).toEqual([
    'website',
  ]);
  expect(deletedComponent.draft.components[0]?.dependencies).toEqual([]);
});

test('validation keeps the latest valid preview and reports actionable controls', () => {
  let draft = createEmptyStackDraft('customer');
  const api = addDraftComponent(draft, { name: 'api', dockerService: 'api' });
  draft = api.draft;
  const endpoint = addDraftEndpoint(draft, api.id, {
    name: 'http',
    allocationMode: 'preferred',
    hostPort: '4100',
    containerPort: '3000',
  });
  draft = endpoint.draft;
  const valid = evaluateStackDraft(draft);
  expect(valid.valid).toBe(true);
  expect(valid.previewCurrent).toBe(true);

  draft = updateDraftEndpoint(draft, endpoint.id, { hostPort: '70000' });
  const untouched = evaluateStackDraft(draft, { previousPreview: valid.preview });
  expect(untouched).toMatchObject({
    valid: false,
    preview: valid.preview,
    previewCurrent: false,
    visibleIssues: [],
  });
  const touched = evaluateStackDraft(draft, {
    previousPreview: valid.preview,
    touched: [`endpoint:${endpoint.id}:host-port`],
  });
  expect(touched.visibleIssues).toEqual([
    expect.objectContaining({
      code: 'invalid_port',
      controlId: `endpoint:${endpoint.id}:host-port`,
    }),
  ]);
  expect(evaluateStackDraft(draft, { submit: true }).firstInvalidControlId).toBe(
    `endpoint:${endpoint.id}:host-port`,
  );
});

test('validates dependency targets, unpublished endpoints, duplicates, and Docker coupling', () => {
  let draft = createEmptyStackDraft('customer');
  const provider = addDraftComponent(draft, { name: 'api' });
  draft = provider.draft;
  const hidden = addDraftEndpoint(draft, provider.id, {
    name: 'hidden',
    publish: false,
    containerPort: '3000',
  });
  draft = hidden.draft;
  const consumer = addDraftComponent(draft, { name: 'api' });
  draft = consumer.draft;
  const dependency = addDraftDependency(draft, consumer.id, {
    alias: 'backend',
    targetComponentId: provider.id,
    targetEndpointId: hidden.id,
  });
  draft = dependency.draft;
  const evaluation = evaluateStackDraft(draft, { submit: true });
  expect(evaluation.issues.map(({ code }) => code)).toEqual(
    expect.arrayContaining([
      'duplicate_name',
      'docker_service_required',
      'dependency_endpoint_unpublished',
    ]),
  );

  draft = updateDraftComponent(draft, consumer.id, { name: 'website' });
  draft = updateDraftDependency(draft, dependency.id, {
    targetComponentId: consumer.id,
  });
  expect(evaluateStackDraft(draft, { submit: true }).issues).toContainEqual(
    expect.objectContaining({
      code: 'dependency_endpoint_required',
      controlId: `dependency:${dependency.id}:target-endpoint`,
    }),
  );
});

test('preserves editor order even for integer-like schema names', () => {
  let draft = createEmptyStackDraft('ordered');
  for (const name of ['10', '2', 'alpha']) {
    draft = addDraftComponent(draft, { name }).draft;
  }
  const content = serializeStackDraft(draft).content;
  expect(content.indexOf('"10"')).toBeLessThan(content.indexOf('"2"'));
  expect(content.indexOf('"2"')).toBeLessThan(content.indexOf('"alpha"'));
  expect(content.endsWith('\n')).toBe(true);
});

function fullDefinition() {
  return {
    version: 1,
    project: 'customer',
    components: {
      api: {
        endpoints: {
          default: {
            transport: 'tcp',
            publish: true,
            required: true,
            allocation: { preferredPort: 4100 },
          },
          admin: {
            transport: 'tcp',
            publish: true,
            required: false,
            allocation: { exactPort: 4200 },
            docker: { containerPort: 3000 },
          },
          private: {
            transport: 'tcp',
            publish: false,
            required: true,
            allocation: {},
          },
        },
        dependencies: {},
        docker: { service: 'api' },
      },
      website: {
        endpoints: {
          default: {
            transport: 'tcp',
            publish: true,
            required: true,
            allocation: {},
          },
        },
        dependencies: {
          backend: { component: 'api', endpoint: 'default', required: true },
          optionalAdmin: {
            component: 'api',
            endpoint: 'admin',
            required: false,
          },
        },
      },
    },
  };
}
