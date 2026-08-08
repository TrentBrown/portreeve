// @ts-check

const STACK_NAME_MAX_LENGTH = 128;
const PORT_MAX = 65_535;
const ORDERED_ENTRIES = Symbol('orderedEntries');

/**
 * @typedef {object} EndpointDraft
 * @property {string} id
 * @property {string} name
 * @property {boolean} publish
 * @property {boolean} required
 * @property {'automatic'|'preferred'|'exact'} allocationMode
 * @property {string} hostPort
 * @property {string} containerPort
 */

/**
 * @typedef {object} DependencyDraft
 * @property {string} id
 * @property {string} alias
 * @property {string} targetComponentId
 * @property {string} targetEndpointId
 * @property {boolean} required
 */

/**
 * @typedef {object} ComponentDraft
 * @property {string} id
 * @property {string} name
 * @property {string} dockerService
 * @property {EndpointDraft[]} endpoints
 * @property {DependencyDraft[]} dependencies
 */

/**
 * @typedef {object} StackDraft
 * @property {number} schemaVersion
 * @property {string} project
 * @property {ComponentDraft[]} components
 * @property {number} nextIdentity
 */

/** @param {string} [suggestedProject] @returns {StackDraft} */
export function createEmptyStackDraft(suggestedProject = '') {
  return {
    schemaVersion: 1,
    project: suggestedProject,
    components: [],
    nextIdentity: 1,
  };
}

/** @param {any} definition @returns {StackDraft} */
export function loadStackDraft(definition) {
  let draft = createEmptyStackDraft(String(definition.project ?? ''));
  /** @type {Map<string, string>} */
  const componentIds = new Map();
  /** @type {Map<string, string>} */
  const endpointIds = new Map();

  for (const [componentName, componentDefinition] of Object.entries(
    definition.components ?? {},
  )) {
    const added = addDraftComponent(draft, {
      name: componentName,
      dockerService: componentDefinition?.docker?.service ?? '',
    });
    draft = added.draft;
    componentIds.set(componentName, added.id);
    for (const [endpointName, endpointDefinition] of Object.entries(
      componentDefinition?.endpoints ?? {},
    )) {
      const allocationMode =
        endpointDefinition?.allocation?.exactPort !== undefined
          ? 'exact'
          : endpointDefinition?.allocation?.preferredPort !== undefined
            ? 'preferred'
            : 'automatic';
      const hostPort =
        allocationMode === 'exact'
          ? endpointDefinition.allocation.exactPort
          : allocationMode === 'preferred'
            ? endpointDefinition.allocation.preferredPort
            : '';
      const endpoint = addDraftEndpoint(draft, added.id, {
        name: endpointName,
        publish: endpointDefinition?.publish ?? true,
        required: endpointDefinition?.required ?? true,
        allocationMode,
        hostPort: hostPort === '' ? '' : String(hostPort),
        containerPort:
          endpointDefinition?.docker?.containerPort === undefined
            ? ''
            : String(endpointDefinition.docker.containerPort),
      });
      draft = endpoint.draft;
      endpointIds.set(endpointKey(componentName, endpointName), endpoint.id);
    }
  }

  for (const [componentName, componentDefinition] of Object.entries(
    definition.components ?? {},
  )) {
    const consumerId = componentIds.get(componentName);
    if (consumerId === undefined) throw new TypeError('Invalid component identity.');
    for (const [alias, dependencyDefinition] of Object.entries(
      componentDefinition?.dependencies ?? {},
    )) {
      const targetComponentId = componentIds.get(dependencyDefinition.component);
      const targetEndpointId = endpointIds.get(
        endpointKey(
          dependencyDefinition.component,
          dependencyDefinition.endpoint ?? 'default',
        ),
      );
      if (targetComponentId === undefined || targetEndpointId === undefined) {
        throw new TypeError('Invalid dependency target identity.');
      }
      draft = addDraftDependency(draft, consumerId, {
        alias,
        targetComponentId,
        targetEndpointId,
        required: dependencyDefinition.required ?? true,
      }).draft;
    }
  }
  return draft;
}

/** @param {StackDraft} draft @param {{name?: string, dockerService?: string}} [values] */
export function addDraftComponent(draft, values = {}) {
  const next = cloneDraft(draft);
  const id = allocateIdentity(next, 'component');
  next.components.push({
    id,
    name: values.name ?? '',
    dockerService: values.dockerService ?? '',
    endpoints: [],
    dependencies: [],
  });
  return { draft: next, id };
}

/** @param {StackDraft} draft @param {string} componentId @param {Record<string, unknown>} values */
export function updateDraftComponent(draft, componentId, values) {
  const next = cloneDraft(draft);
  const component = requireComponent(next, componentId);
  assignAllowed(component, values, ['name', 'dockerService']);
  return next;
}

/**
 * @param {StackDraft} draft
 * @param {string} componentId
 * @param {{name?: string, publish?: boolean, required?: boolean, allocationMode?: 'automatic'|'preferred'|'exact', hostPort?: string, containerPort?: string}} [values]
 */
export function addDraftEndpoint(draft, componentId, values = {}) {
  const next = cloneDraft(draft);
  const id = allocateIdentity(next, 'endpoint');
  requireComponent(next, componentId).endpoints.push({
    id,
    name: values.name ?? '',
    publish: values.publish ?? true,
    required: values.required ?? true,
    allocationMode: values.allocationMode ?? 'automatic',
    hostPort: values.hostPort ?? '',
    containerPort: values.containerPort ?? '',
  });
  return { draft: next, id };
}

/** @param {StackDraft} draft @param {string} endpointId @param {Record<string, unknown>} values */
export function updateDraftEndpoint(draft, endpointId, values) {
  const next = cloneDraft(draft);
  const endpoint = requireEndpoint(next, endpointId).endpoint;
  assignAllowed(endpoint, values, [
    'name',
    'publish',
    'required',
    'allocationMode',
    'hostPort',
    'containerPort',
  ]);
  return next;
}

/**
 * @param {StackDraft} draft
 * @param {string} componentId
 * @param {{alias?: string, targetComponentId?: string, targetEndpointId?: string, required?: boolean}} [values]
 */
export function addDraftDependency(draft, componentId, values = {}) {
  const next = cloneDraft(draft);
  const id = allocateIdentity(next, 'dependency');
  requireComponent(next, componentId).dependencies.push({
    id,
    alias: values.alias ?? '',
    targetComponentId: values.targetComponentId ?? '',
    targetEndpointId: values.targetEndpointId ?? '',
    required: values.required ?? true,
  });
  return { draft: next, id };
}

/** @param {StackDraft} draft @param {string} dependencyId @param {Record<string, unknown>} values */
export function updateDraftDependency(draft, dependencyId, values) {
  const next = cloneDraft(draft);
  const dependency = requireDependency(next, dependencyId).dependency;
  assignAllowed(dependency, values, [
    'alias',
    'targetComponentId',
    'targetEndpointId',
    'required',
  ]);
  return next;
}

/** @param {StackDraft} draft @param {string} dependencyId */
export function deleteDraftDependency(draft, dependencyId) {
  const next = cloneDraft(draft);
  const found = requireDependency(next, dependencyId);
  found.component.dependencies.splice(found.index, 1);
  return next;
}

/** @param {StackDraft} draft @param {{kind: 'component'|'endpoint', id: string}} target */
export function draftDeletionImpact(draft, target) {
  const targetRecord = deletionTarget(draft, target);
  const dependencies = [];
  for (const component of draft.components) {
    if (target.kind === 'component' && component.id === target.id) continue;
    for (const dependency of component.dependencies) {
      const affected =
        target.kind === 'component'
          ? dependency.targetComponentId === target.id
          : dependency.targetEndpointId === target.id;
      if (affected) {
        dependencies.push({
          dependencyId: dependency.id,
          consumerComponentId: component.id,
          consumerComponentName: component.name,
          alias: dependency.alias,
        });
      }
    }
  }
  return {
    target,
    label: targetRecord.label,
    dependencies,
  };
}

/**
 * @param {StackDraft} draft
 * @param {{kind: 'component'|'endpoint', id: string}} target
 * @param {{cascade?: boolean}} [options]
 */
export function deleteDraftTarget(draft, target, options = {}) {
  const impact = draftDeletionImpact(draft, target);
  if (impact.dependencies.length > 0 && options.cascade !== true) {
    return {
      draft,
      deleted: false,
      requiresConfirmation: true,
      impact,
    };
  }
  const next = cloneDraft(draft);
  if (target.kind === 'component') {
    const index = next.components.findIndex(({ id }) => id === target.id);
    if (index < 0) throw new TypeError('Unknown component identity.');
    next.components.splice(index, 1);
    for (const component of next.components) {
      component.dependencies = component.dependencies.filter(
        ({ targetComponentId }) => targetComponentId !== target.id,
      );
    }
  } else {
    const found = requireEndpoint(next, target.id);
    found.component.endpoints.splice(found.index, 1);
    for (const component of next.components) {
      component.dependencies = component.dependencies.filter(
        ({ targetEndpointId }) => targetEndpointId !== target.id,
      );
    }
  }
  return { draft: next, deleted: true, requiresConfirmation: false, impact };
}

/**
 * @param {StackDraft} draft
 * @param {{touched?: Iterable<string>, submit?: boolean, previousPreview?: string|null}} [options]
 */
export function evaluateStackDraft(draft, options = {}) {
  const issues = validateDraft(draft);
  const valid = issues.length === 0;
  const touched = new Set(options.touched ?? []);
  const visibleIssues =
    options.submit === true
      ? issues
      : issues.filter(({ controlId }) => touched.has(controlId));
  const definition = valid ? definitionFromDraft(draft) : null;
  const content = valid ? serializeDefinitionDraft(draft) : null;
  return {
    valid,
    definition,
    content,
    preview: content ?? options.previousPreview ?? null,
    previewCurrent: valid,
    issues,
    visibleIssues,
    firstInvalidControlId:
      options.submit === true ? (issues[0]?.controlId ?? null) : null,
  };
}

/** @param {StackDraft} draft */
export function serializeStackDraft(draft) {
  const result = evaluateStackDraft(draft, { submit: true });
  if (!result.valid || result.content === null || result.definition === null) {
    const error = new TypeError('The stack draft is not valid.');
    Object.assign(error, { issues: result.issues });
    throw error;
  }
  return { definition: result.definition, content: result.content };
}

/** @param {StackDraft} draft */
function validateDraft(draft) {
  /** @type {Array<{code: string, message: string, path: Array<string|number>, controlId: string}>} */
  const issues = [];
  validateName(draft.project, ['project'], 'project', 'Project', issues);
  if (!Array.isArray(draft.components) || draft.components.length === 0) {
    issues.push(
      issue(
        'component_required',
        'Add at least one component.',
        ['components'],
        'components',
      ),
    );
    return issues;
  }

  const componentNames = new Set();
  const componentIds = new Set();
  const endpointById = new Map();
  for (const [componentIndex, component] of draft.components.entries()) {
    const componentControl = `component:${component.id}:name`;
    validateIdentity(component.id, componentIds, componentControl, issues);
    validateName(
      component.name,
      ['components', componentIndex, 'name'],
      componentControl,
      'Component name',
      issues,
    );
    validateUniqueName(
      component.name,
      componentNames,
      ['components', componentIndex, 'name'],
      componentControl,
      'Component name',
      issues,
    );
    if (component.dockerService !== '') {
      validateName(
        component.dockerService,
        ['components', componentIndex, 'dockerService'],
        `component:${component.id}:docker-service`,
        'Docker service',
        issues,
      );
    }
    const endpointNames = new Set();
    for (const [endpointIndex, endpoint] of component.endpoints.entries()) {
      const endpointControl = `endpoint:${endpoint.id}:name`;
      validateIdentity(endpoint.id, endpointById, endpointControl, issues);
      endpointById.set(endpoint.id, { component, endpoint });
      validateName(
        endpoint.name,
        ['components', componentIndex, 'endpoints', endpointIndex, 'name'],
        endpointControl,
        'Endpoint name',
        issues,
      );
      validateUniqueName(
        endpoint.name,
        endpointNames,
        ['components', componentIndex, 'endpoints', endpointIndex, 'name'],
        endpointControl,
        'Endpoint name',
        issues,
      );
      validateBoolean(
        endpoint.publish,
        ['components', componentIndex, 'endpoints', endpointIndex, 'publish'],
        `endpoint:${endpoint.id}:publish`,
        'Publish',
        issues,
      );
      validateBoolean(
        endpoint.required,
        ['components', componentIndex, 'endpoints', endpointIndex, 'required'],
        `endpoint:${endpoint.id}:required`,
        'Required',
        issues,
      );
      if (!['automatic', 'preferred', 'exact'].includes(endpoint.allocationMode)) {
        issues.push(
          issue(
            'invalid_allocation_mode',
            'Choose automatic, preferred, or exact host-port allocation.',
            [
              'components',
              componentIndex,
              'endpoints',
              endpointIndex,
              'allocationMode',
            ],
            `endpoint:${endpoint.id}:allocation-mode`,
          ),
        );
      } else if (endpoint.allocationMode !== 'automatic') {
        validatePort(
          endpoint.hostPort,
          ['components', componentIndex, 'endpoints', endpointIndex, 'hostPort'],
          `endpoint:${endpoint.id}:host-port`,
          'Host port',
          true,
          issues,
        );
      }
      const containerPort = validatePort(
        endpoint.containerPort,
        ['components', componentIndex, 'endpoints', endpointIndex, 'containerPort'],
        `endpoint:${endpoint.id}:container-port`,
        'Container port',
        false,
        issues,
      );
      if (containerPort !== null && component.dockerService === '') {
        issues.push(
          issue(
            'docker_service_required',
            'Add a Docker service before assigning a container port.',
            ['components', componentIndex, 'endpoints', endpointIndex, 'containerPort'],
            `endpoint:${endpoint.id}:container-port`,
          ),
        );
      }
    }
  }

  const dependencyIds = new Set();
  for (const [componentIndex, component] of draft.components.entries()) {
    const dependencyAliases = new Set();
    for (const [dependencyIndex, dependency] of component.dependencies.entries()) {
      const aliasControl = `dependency:${dependency.id}:alias`;
      validateIdentity(dependency.id, dependencyIds, aliasControl, issues);
      validateName(
        dependency.alias,
        ['components', componentIndex, 'dependencies', dependencyIndex, 'alias'],
        aliasControl,
        'Dependency alias',
        issues,
      );
      validateUniqueName(
        dependency.alias,
        dependencyAliases,
        ['components', componentIndex, 'dependencies', dependencyIndex, 'alias'],
        aliasControl,
        'Dependency alias',
        issues,
      );
      const targetComponent = draft.components.find(
        ({ id }) => id === dependency.targetComponentId,
      );
      if (targetComponent === undefined) {
        issues.push(
          issue(
            'dependency_component_required',
            'Choose a dependency component.',
            [
              'components',
              componentIndex,
              'dependencies',
              dependencyIndex,
              'component',
            ],
            `dependency:${dependency.id}:target-component`,
          ),
        );
      }
      const target = endpointById.get(dependency.targetEndpointId);
      if (
        target === undefined ||
        target.component.id !== dependency.targetComponentId
      ) {
        issues.push(
          issue(
            'dependency_endpoint_required',
            'Choose an endpoint from the dependency component.',
            ['components', componentIndex, 'dependencies', dependencyIndex, 'endpoint'],
            `dependency:${dependency.id}:target-endpoint`,
          ),
        );
      } else if (target.endpoint.publish !== true) {
        issues.push(
          issue(
            'dependency_endpoint_unpublished',
            'Dependencies must target a published endpoint.',
            ['components', componentIndex, 'dependencies', dependencyIndex, 'endpoint'],
            `dependency:${dependency.id}:target-endpoint`,
          ),
        );
      }
      validateBoolean(
        dependency.required,
        ['components', componentIndex, 'dependencies', dependencyIndex, 'required'],
        `dependency:${dependency.id}:required`,
        'Required',
        issues,
      );
    }
  }
  return issues;
}

/** @param {StackDraft} draft */
function definitionFromDraft(draft) {
  /** @type {Record<string, any>} */
  const components = {};
  for (const component of draft.components) {
    /** @type {Record<string, any>} */
    const endpoints = {};
    for (const endpoint of component.endpoints) {
      endpoints[endpoint.name] = endpointDefinition(endpoint);
    }
    /** @type {Record<string, any>} */
    const dependencies = {};
    for (const dependency of component.dependencies) {
      dependencies[dependency.alias] = dependencyDefinition(draft, dependency);
    }
    components[component.name] = {
      endpoints,
      dependencies,
      ...(component.dockerService === ''
        ? {}
        : { docker: { service: component.dockerService } }),
    };
  }
  return { version: 1, project: draft.project, components };
}

/** @param {StackDraft} draft */
function serializeDefinitionDraft(draft) {
  /** @type {Array<[string, any]>} */
  const componentEntries = [];
  for (const component of draft.components) {
    /** @type {Array<[string, any]>} */
    const entries = [];
    if (component.endpoints.length > 0) {
      /** @type {Array<[string, any]>} */
      const endpoints = [];
      for (const endpoint of component.endpoints) {
        endpoints.push([endpoint.name, ordered(endpointEntries(endpoint))]);
      }
      entries.push(['endpoints', ordered(endpoints)]);
    }
    if (component.dependencies.length > 0) {
      /** @type {Array<[string, any]>} */
      const dependencies = [];
      for (const dependency of component.dependencies) {
        dependencies.push([
          dependency.alias,
          ordered(dependencyEntries(draft, dependency)),
        ]);
      }
      entries.push(['dependencies', ordered(dependencies)]);
    }
    if (component.dockerService !== '') {
      entries.push(['docker', ordered([['service', component.dockerService]])]);
    }
    componentEntries.push([component.name, ordered(entries)]);
  }
  const components = ordered(componentEntries);
  return `${renderJson(
    ordered([
      ['version', 1],
      ['project', draft.project],
      ['components', components],
    ]),
    0,
  )}\n`;
}

/** @param {EndpointDraft} endpoint */
function endpointDefinition(endpoint) {
  const definition = {
    transport: 'tcp',
    publish: endpoint.publish,
    required: endpoint.required,
    allocation:
      endpoint.allocationMode === 'preferred'
        ? { preferredPort: Number(endpoint.hostPort) }
        : endpoint.allocationMode === 'exact'
          ? { exactPort: Number(endpoint.hostPort) }
          : {},
  };
  return endpoint.containerPort === ''
    ? definition
    : { ...definition, docker: { containerPort: Number(endpoint.containerPort) } };
}

/** @param {EndpointDraft} endpoint @returns {Array<[string, any]>} */
function endpointEntries(endpoint) {
  /** @type {Array<[string, any]>} */
  const entries = [];
  if (endpoint.publish !== true) entries.push(['publish', false]);
  if (endpoint.required !== true) entries.push(['required', false]);
  if (endpoint.allocationMode === 'preferred') {
    entries.push([
      'allocation',
      ordered([['preferredPort', Number(endpoint.hostPort)]]),
    ]);
  } else if (endpoint.allocationMode === 'exact') {
    entries.push(['allocation', ordered([['exactPort', Number(endpoint.hostPort)]])]);
  }
  if (endpoint.containerPort !== '') {
    entries.push([
      'docker',
      ordered([['containerPort', Number(endpoint.containerPort)]]),
    ]);
  }
  return entries;
}

/** @param {StackDraft} draft @param {DependencyDraft} dependency */
function dependencyDefinition(draft, dependency) {
  const target = dependencyTarget(draft, dependency);
  return {
    component: target.component.name,
    endpoint: target.endpoint.name,
    required: dependency.required,
  };
}

/** @param {StackDraft} draft @param {DependencyDraft} dependency @returns {Array<[string, any]>} */
function dependencyEntries(draft, dependency) {
  const target = dependencyTarget(draft, dependency);
  /** @type {Array<[string, any]>} */
  const entries = [['component', target.component.name]];
  if (target.endpoint.name !== 'default') {
    entries.push(['endpoint', target.endpoint.name]);
  }
  if (dependency.required !== true) entries.push(['required', false]);
  return entries;
}

/** @param {StackDraft} draft @param {DependencyDraft} dependency */
function dependencyTarget(draft, dependency) {
  const component = requireComponent(draft, dependency.targetComponentId);
  const endpoint = component.endpoints.find(
    ({ id }) => id === dependency.targetEndpointId,
  );
  if (endpoint === undefined) throw new TypeError('Unknown dependency endpoint.');
  return { component, endpoint };
}

/** @param {Array<[string, any]>} entries */
function ordered(entries) {
  return { [ORDERED_ENTRIES]: entries };
}

/** @param {any} value @param {number} depth @returns {string} */
function renderJson(value, depth) {
  if (typeof value !== 'object' || value === null || !(ORDERED_ENTRIES in value)) {
    return JSON.stringify(value);
  }
  /** @type {Array<[string, any]>} */
  const entries = value[ORDERED_ENTRIES];
  if (entries.length === 0) return '{}';
  const indentation = '  '.repeat(depth + 1);
  return `{
${entries
  .map(
    ([key, child]) =>
      `${indentation}${JSON.stringify(key)}: ${renderJson(child, depth + 1)}`,
  )
  .join(',\n')}
${'  '.repeat(depth)}}`;
}

/** @param {StackDraft} draft @param {{kind: 'component'|'endpoint', id: string}} target */
function deletionTarget(draft, target) {
  if (target.kind === 'component') {
    const component = requireComponent(draft, target.id);
    return { label: component.name || 'Unnamed component' };
  }
  const found = requireEndpoint(draft, target.id);
  return {
    label: `${found.component.name || 'Unnamed component'}.${found.endpoint.name || 'Unnamed endpoint'}`,
  };
}

/** @param {StackDraft} draft @returns {StackDraft} */
function cloneDraft(draft) {
  return {
    ...draft,
    components: draft.components.map((component) => ({
      ...component,
      endpoints: component.endpoints.map((endpoint) => ({ ...endpoint })),
      dependencies: component.dependencies.map((dependency) => ({ ...dependency })),
    })),
  };
}

/** @param {StackDraft} draft @param {string} kind */
function allocateIdentity(draft, kind) {
  const value = draft.nextIdentity;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError('Invalid draft identity sequence.');
  }
  draft.nextIdentity += 1;
  return `${kind}-${value}`;
}

/** @param {StackDraft} draft @param {string} componentId @returns {ComponentDraft} */
function requireComponent(draft, componentId) {
  const component = draft.components.find(({ id }) => id === componentId);
  if (component === undefined) throw new TypeError('Unknown component identity.');
  return component;
}

/** @param {StackDraft} draft @param {string} endpointId @returns {{component: ComponentDraft, endpoint: EndpointDraft, index: number}} */
function requireEndpoint(draft, endpointId) {
  for (const component of draft.components) {
    const index = component.endpoints.findIndex(({ id }) => id === endpointId);
    const endpoint = component.endpoints[index];
    if (index >= 0 && endpoint !== undefined) {
      return { component, endpoint, index };
    }
  }
  throw new TypeError('Unknown endpoint identity.');
}

/** @param {StackDraft} draft @param {string} dependencyId @returns {{component: ComponentDraft, dependency: DependencyDraft, index: number}} */
function requireDependency(draft, dependencyId) {
  for (const component of draft.components) {
    const index = component.dependencies.findIndex(({ id }) => id === dependencyId);
    const dependency = component.dependencies[index];
    if (index >= 0 && dependency !== undefined) {
      return { component, dependency, index };
    }
  }
  throw new TypeError('Unknown dependency identity.');
}

/** @param {Record<string, any>} target @param {Record<string, unknown>} values @param {string[]} keys */
function assignAllowed(target, values, keys) {
  for (const key of keys) {
    if (key in values) target[key] = values[key];
  }
}

/** @param {string} component @param {string} endpoint */
function endpointKey(component, endpoint) {
  return `${component}\u0000${endpoint}`;
}

/**
 * @param {unknown} value
 * @param {Array<string|number>} path
 * @param {string} controlId
 * @param {string} label
 * @param {any[]} issues
 */
function validateName(value, path, controlId, label, issues) {
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(issue('name_required', `${label} is required.`, path, controlId));
  } else if (value !== value.trim()) {
    issues.push(
      issue(
        'name_whitespace',
        `${label} cannot begin or end with whitespace.`,
        path,
        controlId,
      ),
    );
  } else if (value.length > STACK_NAME_MAX_LENGTH) {
    issues.push(
      issue(
        'name_too_long',
        `${label} must be ${STACK_NAME_MAX_LENGTH} characters or fewer.`,
        path,
        controlId,
      ),
    );
  }
}

/** @param {unknown} value @param {Set<string>} names @param {Array<string|number>} path @param {string} controlId @param {string} label @param {any[]} issues */
function validateUniqueName(value, names, path, controlId, label, issues) {
  if (typeof value !== 'string' || value === '') return;
  if (names.has(value)) {
    issues.push(
      issue('duplicate_name', `${label} must be unique here.`, path, controlId),
    );
  }
  names.add(value);
}

/** @param {unknown} value @param {Set<string>|Map<string, any>} identities @param {string} controlId @param {any[]} issues */
function validateIdentity(value, identities, controlId, issues) {
  if (typeof value !== 'string' || value === '' || identities.has(value)) {
    issues.push(
      issue(
        'invalid_draft_identity',
        'The editor encountered a duplicate or missing draft identity.',
        [],
        controlId,
      ),
    );
    return;
  }
  if (identities instanceof Set) identities.add(value);
}

/** @param {unknown} value @param {Array<string|number>} path @param {string} controlId @param {string} label @param {any[]} issues */
function validateBoolean(value, path, controlId, label, issues) {
  if (typeof value !== 'boolean') {
    issues.push(
      issue('invalid_boolean', `${label} must be selected.`, path, controlId),
    );
  }
}

/** @param {unknown} value @param {Array<string|number>} path @param {string} controlId @param {string} label @param {boolean} required @param {any[]} issues */
function validatePort(value, path, controlId, label, required, issues) {
  if (value === '' && !required) return null;
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d+$/.test(text)) {
    issues.push(
      issue('invalid_port', `${label} must be a whole number.`, path, controlId),
    );
    return null;
  }
  const port = Number(text);
  if (port < 1 || port > PORT_MAX) {
    issues.push(
      issue(
        'invalid_port',
        `${label} must be between 1 and ${PORT_MAX}.`,
        path,
        controlId,
      ),
    );
    return null;
  }
  return port;
}

/** @param {string} code @param {string} message @param {Array<string|number>} path @param {string} controlId */
function issue(code, message, path, controlId) {
  return { code, message, path, controlId };
}
