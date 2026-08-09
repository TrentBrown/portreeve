// @ts-check

const OPERATIONS = /** @type {const} */ (['start', 'stop', 'restart', 'status']);

/** @param {any} document */
export function createLauncherDraft(document) {
  const definition = document.definition;
  const suggestions = document.suggestions;
  /** @param {'start'|'stop'|'restart'|'status'} operation */
  const suggested = (operation) =>
    suggestions.operations[operation].suggestion?.command ?? '';
  const environment =
    definition?.environment ??
    (document.fileState === 'missing' ? suggestions.environment : []);
  return {
    integrationMode: definition?.integration.mode ?? 'command-only',
    shell: definition?.shell ?? 'system',
    workingDirectory: definition?.workingDirectory ?? '.',
    start: {
      command: definition?.operations.start.command ?? suggested('start'),
      mode: definition?.operations.start.mode ?? 'finite',
      timeoutSeconds: String(definition?.operations.start.timeoutSeconds ?? 300),
    },
    stop: {
      command: definition?.operations.stop.command ?? suggested('stop'),
      timeoutSeconds: String(definition?.operations.stop.timeoutSeconds ?? 120),
    },
    restart: optionalOperation(
      definition?.operations.restart,
      suggested('restart'),
      420,
    ),
    status: optionalOperation(definition?.operations.status, suggested('status'), 30),
    environment: environment.map(
      (/** @type {any} */ mapping, /** @type {number} */ index) => ({
        id: `environment-${index + 1}`,
        name: mapping.name,
        component: mapping.endpoint.component,
        endpoint: mapping.endpoint.endpoint,
        value: mapping.value,
        scheme: mapping.scheme ?? 'http',
      }),
    ),
    nextIdentity: environment.length + 1,
  };
}

/** @param {any} operation @param {string} suggested @param {number} timeoutSeconds */
function optionalOperation(operation, suggested, timeoutSeconds) {
  return {
    enabled: operation !== undefined || suggested !== '',
    command: operation?.command ?? suggested,
    timeoutSeconds: String(operation?.timeoutSeconds ?? timeoutSeconds),
  };
}

/** @param {any} draft */
export function launcherDraftSignature(draft) {
  return JSON.stringify(draft);
}

/** @param {any} draft @param {any} stack */
export function buildLauncherDefinition(draft, stack) {
  /** @type {Array<{path: string, message: string}>} */
  const issues = [];
  /** @param {string} value @param {string} path @param {string} label */
  const requiredCommand = (value, path, label) => {
    if (typeof value !== 'string' || value.trim() === '') {
      issues.push({ path, message: `${label} command is required.` });
    }
    return value;
  };
  /** @param {string} value @param {string} path @param {number} fallback */
  const timeout = (value, path, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 86_400) {
      issues.push({ path, message: 'Timeout must be an integer from 1 to 86400.' });
      return fallback;
    }
    return parsed;
  };
  if (
    draft.workingDirectory.trim() === '' ||
    draft.workingDirectory.includes('\0') ||
    draft.workingDirectory.startsWith('/') ||
    /^[A-Za-z]:[\\/]/u.test(draft.workingDirectory)
  ) {
    issues.push({
      path: 'workingDirectory',
      message: 'Working directory must be a relative path inside the stack root.',
    });
  }
  if (draft.start.mode === 'attached' && draft.restart.enabled) {
    issues.push({
      path: 'restart.enabled',
      message: 'Attached Start always uses PortReeve composed Restart.',
    });
  }
  const environment = [];
  const names = new Set();
  for (const [index, mapping] of draft.environment.entries()) {
    const base = `environment.${index}`;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(mapping.name)) {
      issues.push({ path: `${base}.name`, message: 'Use a valid environment name.' });
    }
    if (mapping.name.startsWith('PORTREEVE_')) {
      issues.push({
        path: `${base}.name`,
        message: 'PORTREEVE_ names are reserved by PortReeve.',
      });
    }
    if (names.has(mapping.name)) {
      issues.push({
        path: `${base}.name`,
        message: 'Environment names must be unique.',
      });
    }
    names.add(mapping.name);
    const component = stack?.components.find(
      (/** @type {any} */ entry) => entry.name === mapping.component,
    );
    const endpoint = component?.endpoints.find(
      (/** @type {any} */ entry) => entry.name === mapping.endpoint,
    );
    if (component === undefined || endpoint === undefined) {
      issues.push({
        path: `${base}.endpoint`,
        message: 'Choose an endpoint from this stack.',
      });
    } else if (['host-port', 'host-url'].includes(mapping.value) && !endpoint.publish) {
      issues.push({
        path: `${base}.value`,
        message: 'Host mappings require a published endpoint.',
      });
    } else if (
      ['container-port', 'docker-network-url'].includes(mapping.value) &&
      (component.dockerService === null || endpoint.containerPort === null)
    ) {
      issues.push({
        path: `${base}.value`,
        message: 'Docker mappings require Docker component and endpoint facts.',
      });
    }
    environment.push({
      name: mapping.name,
      endpoint: { component: mapping.component, endpoint: mapping.endpoint },
      value: mapping.value,
      ...(['host-url', 'docker-network-url'].includes(mapping.value)
        ? { scheme: mapping.scheme }
        : {}),
    });
  }
  const definition = {
    version: 1,
    integration: { mode: draft.integrationMode },
    shell: draft.shell,
    workingDirectory: draft.workingDirectory,
    operations: {
      start: {
        command: requiredCommand(draft.start.command, 'start.command', 'Start'),
        mode: draft.start.mode,
        ...(draft.start.mode === 'finite'
          ? {
              timeoutSeconds: timeout(draft.start.timeoutSeconds, 'start.timeout', 300),
            }
          : {}),
      },
      stop: {
        command: requiredCommand(draft.stop.command, 'stop.command', 'Stop'),
        timeoutSeconds: timeout(draft.stop.timeoutSeconds, 'stop.timeout', 120),
      },
      ...(draft.restart.enabled && draft.start.mode !== 'attached'
        ? {
            restart: {
              command: requiredCommand(
                draft.restart.command,
                'restart.command',
                'Restart',
              ),
              timeoutSeconds: timeout(
                draft.restart.timeoutSeconds,
                'restart.timeout',
                420,
              ),
            },
          }
        : {}),
      ...(draft.status.enabled
        ? {
            status: {
              command: requiredCommand(
                draft.status.command,
                'status.command',
                'Status',
              ),
              timeoutSeconds: timeout(
                draft.status.timeoutSeconds,
                'status.timeout',
                30,
              ),
            },
          }
        : {}),
    },
    environment,
  };
  const content = `${JSON.stringify(sortObject(definition), null, 2)}\n`;
  return { definition, content, issues };
}

/** @param {any} definition @param {any} stack */
export function launcherEnvironmentPreview(definition, stack) {
  if (definition === null || stack === null) return [];
  return definition.environment.map((/** @type {any} */ mapping) => {
    const component = stack.components.find(
      (/** @type {any} */ entry) => entry.name === mapping.endpoint.component,
    );
    const endpoint = component?.endpoints.find(
      (/** @type {any} */ entry) => entry.name === mapping.endpoint.endpoint,
    );
    const generationEndpoint = stack.generation?.endpoints.find(
      (/** @type {any} */ entry) =>
        entry.component === mapping.endpoint.component &&
        entry.endpoint === mapping.endpoint.endpoint,
    );
    let value = null;
    if (mapping.value === 'host-port' && generationEndpoint !== undefined) {
      value = String(generationEndpoint.port);
    }
    if (mapping.value === 'host-url' && generationEndpoint !== undefined) {
      value = `${mapping.scheme}://127.0.0.1:${generationEndpoint.port}`;
    }
    if (
      mapping.value === 'container-port' &&
      endpoint !== undefined &&
      endpoint.containerPort !== null
    ) {
      value = String(endpoint.containerPort);
    }
    if (
      mapping.value === 'docker-network-url' &&
      component !== undefined &&
      component.dockerService !== null &&
      endpoint !== undefined &&
      endpoint.containerPort !== null
    ) {
      value = `${mapping.scheme}://${component.dockerService}:${endpoint.containerPort}`;
    }
    return {
      name: mapping.name,
      endpoint: `${mapping.endpoint.component}.${mapping.endpoint.endpoint}`,
      kind: mapping.value,
      value,
    };
  });
}

/** @param {any} summary @param {any|null} document @param {any|null} session */
export function launcherAvailability(summary, document, session) {
  if (session?.state === 'running') {
    return {
      actions: session.operation === 'start' ? ['status', 'stop'] : [],
      reasons: ['A launcher operation is currently running.'],
    };
  }
  if (summary.fileState !== 'valid' || document?.definition === null) {
    return { actions: [], reasons: ['Create a valid launcher definition first.'] };
  }
  if (!summary.trusted) {
    return {
      actions: [],
      reasons: ['Save and Trust this exact launcher revision first.'],
    };
  }
  if (summary.evidence === null || summary.evidence?.source === 'unavailable') {
    return {
      actions: [],
      reasons: [
        'Listener and allocation evidence is unavailable. Restore PortReeve, then refresh.',
      ],
    };
  }
  if (['cached', 'local'].includes(summary.evidence?.source)) {
    return {
      actions: ['status', 'stop'],
      reasons: [
        'Only degraded Status and explicitly confirmed Stop are available from stale local context.',
      ],
    };
  }
  if (summary.evidence?.classification === 'conflicting') {
    return {
      actions: ['status', 'stop'],
      reasons: ['Conflicting ownership blocks Start and Restart.'],
    };
  }
  if (summary.evidence?.classification === 'uncertain') {
    return {
      actions: ['status', 'stop'],
      reasons: ['Uncertain listener evidence blocks Start and Restart.'],
    };
  }
  if (['verified', 'fully-observed'].includes(summary.evidence?.classification)) {
    return {
      actions: ['stop', 'restart', 'status'],
      reasons: ['Start is withheld because the stack is already observed as running.'],
    };
  }
  return { actions: [...OPERATIONS], reasons: [] };
}

/** @param {unknown} value @returns {any} */
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortObject(child)]),
  );
}
