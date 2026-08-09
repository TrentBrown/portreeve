// @ts-check

import {
  availableActions,
  availableStackActions,
  canUninstall,
  stackPresentationState,
  stackRenderSignature,
  updatePresentation,
} from './state.js';
import { createStackEditorView } from './stack-editor-view.js';

/** @type {any} */
let snapshot = null;
let filter = '';
/** @type {number|null} */
let selectedPort = null;
/** @type {string|null} */
let selectedStack = null;
/** @type {string|null} */
let renderedStacksSignature = null;
let busy = false;

const notice = requiredElement('notice');
const errors = requiredElement('errors');
const statusCards = requiredElement('status-cards');
const versions = requiredElement('versions');
const updateStatus = requiredElement('update-status');
const openDownloadPage = /** @type {HTMLButtonElement} */ (
  requiredElement('open-download-page')
);
const serviceActions = requiredElement('service-actions');
const guidance = requiredElement('action-guidance');
const portRows = requiredElement('port-rows');
const portDetail = requiredElement('port-detail');
const operationResult = requiredElement('operation-result');
const operationMessage = requiredElement('operation-message');
const operationDetails = requiredElement('operation-details');
const stackList = requiredElement('stack-list');
const stackDetail = requiredElement('stack-detail');
const stacksBrowser = requiredElement('stacks-browser');
const stackEditorRoot = requiredElement('stack-editor');
const filterInput = /** @type {HTMLInputElement} */ (requiredElement('port-filter'));
const confirmationDialog = /** @type {HTMLDialogElement} */ (
  requiredElement('confirmation-dialog')
);
const purgeDialog = /** @type {HTMLDialogElement} */ (requiredElement('purge-dialog'));
const purgeConfirmation = /** @type {HTMLInputElement} */ (
  requiredElement('purge-confirmation')
);
const purgeAccept = /** @type {HTMLButtonElement} */ (requiredElement('purge-accept'));
const stackPruneDialog = /** @type {HTMLDialogElement} */ (
  requiredElement('stack-prune-dialog')
);
const stackPruneConfirmation = /** @type {HTMLInputElement} */ (
  requiredElement('stack-prune-confirmation')
);
const stackPruneAccept = /** @type {HTMLButtonElement} */ (
  requiredElement('stack-prune-accept')
);
const snapshotDialog = /** @type {HTMLDialogElement} */ (
  requiredElement('snapshot-dialog')
);
const discardEditorDialog = /** @type {HTMLDialogElement} */ (
  requiredElement('discard-editor-dialog')
);
let snapshotJson = '';

const stackEditor = createStackEditorView({
  root: stackEditorRoot,
  normalView: stacksBrowser,
  api: window.portreeveDesktop,
  confirmDiscard: async () => {
    discardEditorDialog.showModal();
    return (await dialogResult(discardEditorDialog)) === 'discard';
  },
  confirmDelete: (impact) =>
    confirmAction(
      `Delete ${impact.label}?`,
      impact.dependencies.length === 0
        ? 'This removes the selected item from the draft.'
        : `This also removes ${impact.dependencies.length} dependent entr${impact.dependencies.length === 1 ? 'y' : 'ies'}: ${impact.dependencies.map((/** @type {any} */ entry) => `${entry.consumerComponentName}.${entry.alias}`).join(', ')}.`,
      impact.dependencies.length === 0 ? 'Delete' : 'Delete and cascade',
    ),
  confirmOverwrite: (reason) =>
    confirmAction(
      'Overwrite the changed stack definition?',
      overwriteMessage(reason),
      'Overwrite',
    ),
  confirmInvalid: (documentState) =>
    confirmAction(
      'Replace the invalid stack definition?',
      `${documentState.issues.map((/** @type {any} */ issue) => issue.message).join(' ')} ${
        documentState.seedSource === 'applied'
          ? 'The editor can start from the currently applied definition.'
          : 'The editor can start a new replacement draft.'
      } The existing file is not changed unless you later choose Save and Apply and confirm overwrite.`,
      documentState.seedSource === 'applied'
        ? 'Use applied definition'
        : 'Start replacement draft',
    ),
  onSnapshot: render,
  onApplied: (stackId, message, details) => {
    selectedStack = stackId;
    renderedStacksSignature = null;
    renderStacks(true);
    showOperation(message, details);
  },
  onOperation: showOperation,
});

/** @type {Readonly<Record<string, {label: string, title?: string, message?: string, confirm: boolean}>>} */
const actionDefinitions = Object.freeze({
  installAndStart: {
    label: 'Install and Start PortReeve',
    title: 'Install and start PortReeve?',
    message:
      'This installs the bundled CLI under your user account, configures native supervision, and starts the service.',
    confirm: true,
  },
  start: { label: 'Start', confirm: false },
  stop: { label: 'Stop', confirm: false },
  restart: { label: 'Restart', confirm: false },
  stopManual: {
    label: 'Stop manual server',
    title: 'Stop the manual PortReeve server?',
    message:
      'This asks the independently started PortReeve server to stop. It does not adopt it into supervision.',
    confirm: true,
  },
  upgrade: {
    label: 'Upgrade managed service',
    title: 'Upgrade the managed PortReeve service?',
    message:
      'This replaces the managed CLI with the verified bundled version. PortReeve refuses downgrades and unsafe states.',
    confirm: true,
  },
});

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', async () => {
    const view = /** @type {HTMLElement} */ (tab).dataset.view;
    if (view !== 'stacks' && stackEditor.isOpen()) {
      if (!(await stackEditor.requestClose())) return;
    }
    activateTab(tab, view);
  });
}

let closeAfterDiscard = false;
let closePromptOpen = false;
window.addEventListener('beforeunload', (event) => {
  if (closeAfterDiscard || !stackEditor.isDirty()) return;
  event.preventDefault();
  event.returnValue = false;
  if (closePromptOpen) return;
  closePromptOpen = true;
  discardEditorDialog.showModal();
  void dialogResult(discardEditorDialog).then((result) => {
    closePromptOpen = false;
    if (result !== 'discard') return;
    closeAfterDiscard = true;
    window.close();
  });
});

requiredElement('refresh').addEventListener('click', async () => {
  await runBusy(async () => {
    notice.textContent = 'Refreshing…';
    render(await window.portreeveDesktop.refresh());
  });
});
requiredElement('uninstall').addEventListener('click', async () => {
  if (
    !(await confirmAction(
      'Uninstall the PortReeve service?',
      'Native supervision and the managed executable will be removed. Claims, history, and settings will be preserved.',
      'Uninstall service',
    ))
  ) {
    return;
  }
  await invokeLifecycle('uninstall');
});
requiredElement('preview-purge').addEventListener('click', previewPurge);
requiredElement('apply-stack-definition').addEventListener('click', async () => {
  await invokeStack(() => window.portreeveDesktop.applyStackDefinition());
});
requiredElement('create-edit-stack').addEventListener('click', async () => {
  await stackEditor.openSelected();
});
requiredElement('preview-stack-prune').addEventListener('click', previewStackPrune);
openDownloadPage.addEventListener('click', async () => {
  await runBusy(async () => {
    await window.portreeveDesktop.openDownloadPage();
    showOperation('Opened the PortReeve download page.', [
      'Desktop installation remains manual. Managed-service upgrades require separate confirmation.',
    ]);
  });
});
filterInput.addEventListener('input', () => {
  filter = filterInput.value.trim().toLowerCase();
  renderPorts();
});
purgeConfirmation.addEventListener('input', () => {
  purgeAccept.disabled = purgeConfirmation.value !== 'DELETE';
});
stackPruneConfirmation.addEventListener('input', () => {
  stackPruneAccept.disabled = stackPruneConfirmation.value !== 'PRUNE';
});
requiredElement('copy-snapshot').addEventListener('click', async () => {
  await copyText(snapshotJson);
});

window.portreeveDesktop.subscribe(render);
render(await window.portreeveDesktop.getSnapshot());

/** @param {any} next */
function render(next) {
  snapshot = next;
  notice.textContent = next.stale
    ? `Evidence may be stale. Last refresh attempt ${formatTime(next.refreshedAt)}.`
    : `Current as of ${formatTime(next.refreshedAt)}.`;
  notice.classList.toggle('warning', next.stale);
  errors.replaceChildren(...next.errors.map(errorItem));
  errors.hidden = next.errors.length === 0;
  const lifecycle = next.lifecycle;
  statusCards.replaceChildren(
    card('Mode', lifecycle?.mode ?? 'Unavailable'),
    card('Installation', lifecycle?.installation.state ?? 'Unavailable'),
    card('Supervisor', lifecycle?.supervisor.state ?? 'Unavailable'),
    card('Socket', lifecycle?.socket.state ?? 'Unavailable'),
  );
  versions.replaceChildren(
    definition('Desktop app', next.artifact.desktopVersion),
    definition('Bundled CLI', next.artifact.version),
    definition('Managed CLI', lifecycle?.versions.managed ?? 'Not installed'),
    definition('Running server', lifecycle?.versions.running ?? 'Not running'),
    definition(
      'Managed location',
      lifecycle?.installation.managedLocation ?? 'Unavailable',
    ),
    definition(
      'Bundled source',
      next.artifact.source === 'published'
        ? 'Published release'
        : 'Local release candidate',
    ),
  );
  const update = updatePresentation(next.update);
  updateStatus.textContent = update.message;
  openDownloadPage.hidden = !update.canOpenDownloadPage;
  openDownloadPage.disabled = busy || !update.canOpenDownloadPage;
  renderActions();
  renderPorts();
  renderStacks();
  if (busy) setControlsDisabled(true);
}

function renderActions() {
  if (snapshot === null) return;
  const actions = availableActions(snapshot);
  serviceActions.replaceChildren(
    ...actions.map((name) => {
      const definition = actionDefinitions[name];
      if (definition === undefined) throw new Error(`Unknown action ${name}.`);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = definition.label;
      if (name === 'installAndStart') button.className = 'primary';
      button.addEventListener('click', async () => {
        if (
          definition.confirm &&
          !(await confirmAction(
            definition.title ?? definition.label,
            definition.message ?? '',
            definition.label,
          ))
        ) {
          return;
        }
        await invokeLifecycle(name);
      });
      return button;
    }),
  );
  guidance.textContent = actionGuidance(snapshot.lifecycle, actions);
  const uninstall = /** @type {HTMLButtonElement} */ (requiredElement('uninstall'));
  uninstall.disabled = busy || !canUninstall(snapshot);
}

/** @param {string} name */
async function invokeLifecycle(name) {
  await runBusy(async () => {
    const result = await /** @type {any} */ (window.portreeveDesktop)[name]();
    render(result.snapshot);
    showOperation(result.message, [
      `Outcome: ${result.outcome}`,
      ...(result.error ? [`${result.error.code}: ${result.error.message}`] : []),
      ...lifecycleFailureDetails(result.failure),
      ...result.steps.map(
        (/** @type {any} */ step) =>
          `${step.operation}: ${step.outcome}${step.error ? ` — ${step.error.code}: ${step.error.message}` : ''} (${lifecycleEvidenceText(step.after)})`,
      ),
    ]);
  });
}

/** @param {any} failure */
function lifecycleFailureDetails(failure) {
  if (failure === null || failure === undefined) return [];
  return [
    `Failed step: ${failure.step}`,
    ...(failure.exitCode === null ? [] : [`Exit code: ${failure.exitCode}`]),
    ...(failure.timedOut ? ['The operation timed out.'] : []),
    ...(failure.before === null
      ? []
      : [`Before: ${lifecycleEvidenceText(failure.before)}`]),
    ...(failure.after === null
      ? []
      : [`After: ${lifecycleEvidenceText(failure.after)}`]),
    ...(failure.output === null
      ? []
      : [
          `${failure.output.truncated ? 'Trailing output' : 'Output'}: ${failure.output.text}`,
        ]),
  ];
}

/** @param {any} evidence */
function lifecycleEvidenceText(evidence) {
  return `mode ${evidence.mode}; installation ${evidence.installation}; supervisor ${evidence.supervisor}; socket ${evidence.socket}`;
}

/** @param {() => Promise<any>} invoke */
async function invokeStack(invoke) {
  await runBusy(async () => {
    const result = await invoke();
    render(result.snapshot);
    showOperation(result.message, [
      `Outcome: ${result.outcome}`,
      ...(result.error ? [`${result.error.code}: ${result.error.message}`] : []),
    ]);
  });
}

async function previewPurge() {
  await runBusy(async () => {
    const preview = await window.portreeveDesktop.previewPurge();
    requiredElement('purge-summary').textContent = preview.allowed
      ? `${preview.paths.length} paths beneath ${preview.root} are eligible for deletion.`
      : 'PortReeve refused this reset preview. Review the evidence below.';
    requiredElement('purge-paths').replaceChildren(
      ...preview.paths.map((/** @type {any} */ entry) => {
        const item = document.createElement('li');
        item.textContent = `${entry.path} — ${entry.type}, ${formatBytes(entry.size)}`;
        return item;
      }),
    );
    const refusals = requiredElement('purge-refusals');
    refusals.replaceChildren(
      ...preview.refused.map((/** @type {any} */ entry) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = `${entry.path ?? 'Lifecycle'}: ${entry.reason}`;
        return paragraph;
      }),
    );
    refusals.hidden = preview.refused.length === 0;
    purgeConfirmation.value = '';
    purgeConfirmation.disabled = !preview.allowed;
    purgeAccept.disabled = true;
    purgeDialog.showModal();
    const accepted = await dialogResult(purgeDialog);
    if (accepted !== 'confirm') return;
    const result = await window.portreeveDesktop.executePurge(purgeConfirmation.value);
    render(result.snapshot);
    showOperation(result.message, [
      `Outcome: ${result.outcome}`,
      `Removed: ${result.removed.length}`,
      `Retained: ${result.retained.length}`,
      `Already missing: ${result.missing.length}`,
      ...result.refused.map(
        (/** @type {any} */ entry) =>
          `Refused ${entry.path ?? 'lifecycle'}: ${entry.reason}`,
      ),
    ]);
  });
}

function renderPorts() {
  if (snapshot === null) return;
  /** @type {any[]} */
  const entries = snapshot.ports;
  const ports = entries.filter((entry) => {
    const label =
      `${entry.port} ${entry.classification} ${entry.claim?.project ?? ''} ${entry.claim?.service ?? ''} ${entry.claim?.workspaceName ?? ''}`.toLowerCase();
    return label.includes(filter);
  });
  if (!entries.some(({ port }) => port === selectedPort)) selectedPort = null;
  portRows.replaceChildren(
    ...ports.map((entry) => {
      const row = document.createElement('tr');
      row.classList.toggle('selected', selectedPort === entry.port);
      const select = () => {
        selectedPort = entry.port;
        renderPorts();
      };
      row.addEventListener('click', select);
      const portButton = document.createElement('button');
      portButton.type = 'button';
      portButton.className = 'table-link';
      portButton.textContent = String(entry.port);
      portButton.setAttribute('aria-label', `Inspect TCP port ${entry.port}`);
      const portCell = document.createElement('td');
      portCell.append(portButton);
      row.append(
        portCell,
        cell(entry.classification),
        cell(
          entry.claim === null
            ? '—'
            : `${entry.claim.project} / ${entry.claim.service} (${entry.claim.workspaceName})`,
        ),
        cell(
          entry.listeners
            .map((/** @type {any} */ listener) => String(listener.pid))
            .join(', ') || '—',
        ),
      );
      return row;
    }),
  );
  renderPortDetail(entries.find(({ port }) => port === selectedPort) ?? null);
}

/** @param {any} entry */
function renderPortDetail(entry) {
  const heading = document.createElement('h3');
  heading.textContent = entry === null ? 'Port details' : `TCP port ${entry.port}`;
  if (entry === null) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Select a port to inspect its reduced evidence.';
    portDetail.replaceChildren(heading, empty);
    return;
  }
  const claim = document.createElement('dl');
  claim.className = 'definitions detail-definitions';
  claim.append(
    definition('Classification', entry.classification),
    definition(
      'Claim',
      entry.claim === null
        ? 'Unclaimed'
        : `${entry.claim.project} / ${entry.claim.service}`,
    ),
    definition('Claim mode', entry.claim?.mode ?? '—'),
    definition('Workspace', entry.claim?.workspaceName ?? '—'),
    definition('Claim created', entry.claim?.createdAt ?? '—'),
    definition('Claim last used', entry.claim?.lastUsedAt ?? '—'),
    definition('Assignment expires', entry.claim?.assignmentExpiresAt ?? '—'),
    definition('Run state', entry.run?.state ?? '—'),
    definition('Run root PID', entry.run ? String(entry.run.rootPid) : '—'),
  );
  const listenersHeading = document.createElement('h4');
  listenersHeading.textContent = 'Listeners';
  const listeners = document.createElement('div');
  listeners.className = 'listener-list';
  listeners.replaceChildren(
    ...(entry.listeners.length === 0
      ? [paragraph('No live listeners.')]
      : entry.listeners.map((/** @type {any} */ listener) => listenerDetail(listener))),
  );
  portDetail.replaceChildren(heading, claim, listenersHeading, listeners);
}

/** @param {boolean} [force] */
function renderStacks(force = false) {
  if (snapshot === null) return;
  if (stackEditor.isOpen()) return;
  const signature = stackRenderSignature(snapshot);
  if (!force && signature === renderedStacksSignature) return;
  renderedStacksSignature = signature;
  const entries = /** @type {any[]} */ (snapshot.stacks);
  if (!entries.some(({ id }) => id === selectedStack)) selectedStack = null;
  stackList.replaceChildren(
    ...(entries.length === 0
      ? [emptyStackList()]
      : entries.map((stack) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'stack-card';
          button.classList.toggle('selected', selectedStack === stack.id);
          const title = document.createElement('strong');
          title.textContent = stack.project;
          const stackRoot = document.createElement('span');
          stackRoot.textContent = stack.stackRootName;
          const state = document.createElement('span');
          const presentationState = stackPresentationState(stack);
          state.className = `badge state-${presentationState}`;
          state.textContent = presentationState;
          button.append(title, stackRoot, state);
          button.addEventListener('click', () => {
            selectedStack = stack.id;
            renderStacks(true);
          });
          return button;
        })),
  );
  renderStackDetail(entries.find(({ id }) => id === selectedStack) ?? null);
}

function emptyStackList() {
  const empty = document.createElement('div');
  empty.className = 'panel empty-state';
  empty.append(
    paragraph('No stack definitions have been applied.'),
    paragraph('Choose a portreeve.stack.json file to add one.'),
  );
  return empty;
}

/** @param {any} stack */
function renderStackDetail(stack) {
  const heading = document.createElement('h3');
  heading.textContent = stack === null ? 'Stack details' : stack.project;
  if (stack === null) {
    const empty = paragraph(
      'Select a stack to inspect its current coordination state.',
    );
    empty.className = 'muted';
    stackDetail.replaceChildren(heading, empty);
    return;
  }
  const summary = document.createElement('dl');
  summary.className = 'definitions';
  summary.append(
    definition('Stack root', stack.stackRootName),
    definition('Revision', shortId(stack.currentRevision)),
    definition('Generation', stack.generation?.state ?? 'Not prepared'),
    definition('Activation', stack.activation?.state ?? 'None'),
    definition('Components', String(stack.components.length)),
    definition('Last used', stack.lastUsedAt),
  );
  const actions = document.createElement('div');
  actions.className = 'actions stack-actions';
  actions.append(
    actionButton('Edit Definition', () => stackEditor.openKnown(stack.id)),
  );
  const allowedActions = availableStackActions(snapshot, stack);
  if (allowedActions.includes('prepare')) {
    actions.append(
      actionButton('Prepare allocation', () =>
        invokeStack(() => window.portreeveDesktop.prepareStack(stack.id)),
      ),
    );
  }
  if (allowedActions.includes('reconcile')) {
    actions.append(
      actionButton('Reconcile evidence', () =>
        invokeStack(() => window.portreeveDesktop.reconcileStack(stack.activation.id)),
      ),
      actionButton(
        'End activation',
        async () => {
          if (
            await confirmAction(
              'End this stack activation?',
              'PortReeve will verify current provider evidence and release its coordination records. It will not stop project processes or containers.',
              'End activation',
            )
          ) {
            await invokeStack(() =>
              window.portreeveDesktop.endStack(stack.activation.id),
            );
          }
        },
        'danger',
      ),
    );
  }
  if (allowedActions.length === 0) {
    const withheld = paragraph(
      'Stack mutations are withheld until current stack evidence is available.',
    );
    withheld.className = 'muted';
    actions.append(withheld);
  }
  const componentHeading = document.createElement('h4');
  componentHeading.textContent = 'Components and endpoints';
  const components = document.createElement('div');
  components.className = 'component-list';
  components.replaceChildren(
    ...stack.components.map((/** @type {any} */ component) =>
      renderComponent(stack, component),
    ),
  );
  const evidenceHeading = document.createElement('h4');
  evidenceHeading.textContent = 'Provider evidence';
  const evidence = document.createElement('div');
  evidence.className = 'evidence-list';
  evidence.replaceChildren(
    ...(stack.providers.length === 0
      ? [paragraph('No live provider evidence is available for this stack.')]
      : stack.providers.map((/** @type {any} */ provider) => {
          const item = document.createElement('article');
          item.append(
            paragraph(
              `${provider.component}.${provider.endpoint} — ${provider.status} on ${provider.port}`,
            ),
            paragraph(
              `${provider.bindingKind}; ${provider.listeners} listener${provider.listeners === 1 ? '' : 's'}; ${provider.reason}`,
            ),
          );
          return item;
        })),
  );
  stackDetail.replaceChildren(
    heading,
    summary,
    actions,
    componentHeading,
    components,
    evidenceHeading,
    evidence,
  );
}

/** @param {any} stack @param {any} component */
function renderComponent(stack, component) {
  const details = document.createElement('details');
  details.className = 'component';
  const summary = document.createElement('summary');
  summary.textContent = `${component.name}${component.dockerService ? ` — Docker service ${component.dockerService}` : ''}`;
  const body = document.createElement('div');
  body.className = 'component-body';
  const definitionList = document.createElement('ul');
  definitionList.className = 'endpoint-list';
  definitionList.replaceChildren(
    ...component.endpoints.map((/** @type {any} */ endpoint) => {
      const allocation = endpoint.exactPort
        ? `exact ${endpoint.exactPort}`
        : endpoint.preferredPort
          ? `preferred ${endpoint.preferredPort}`
          : 'automatic';
      const docker = endpoint.containerPort
        ? `, container ${endpoint.containerPort}`
        : '';
      const item = document.createElement('li');
      item.textContent = `${endpoint.name}: ${allocation}${docker}; ${endpoint.required ? 'required' : 'optional'}${endpoint.publish ? '' : '; private'}`;
      return item;
    }),
    ...component.dependencies.map((/** @type {any} */ dependency) => {
      const item = document.createElement('li');
      item.textContent = `${dependency.alias} → ${dependency.component}.${dependency.endpoint} (${dependency.required ? 'required' : 'optional'})`;
      return item;
    }),
  );
  const resolution = stack.resolutions.find(
    (/** @type {any} */ entry) => entry.component === component.name,
  );
  const addresses = document.createElement('div');
  addresses.className = 'address-list';
  if (resolution?.error) {
    addresses.append(
      paragraph(`${resolution.error.code}: ${resolution.error.message}`),
    );
  } else if (resolution) {
    for (const endpoint of [...resolution.own, ...resolution.dependencies]) {
      addresses.append(addressLine(endpoint));
    }
  } else {
    addresses.append(
      paragraph('Addresses become available after activation confirmation.'),
    );
  }
  if (
    stack.activation !== null &&
    ['confirmed', 'degraded'].includes(stack.activation.state)
  ) {
    const snapshotControls = document.createElement('div');
    snapshotControls.className = 'snapshot-controls';
    const gateway = document.createElement('input');
    gateway.type = 'text';
    gateway.value = 'host.docker.internal';
    gateway.setAttribute('aria-label', `Gateway host for ${component.name}`);
    snapshotControls.append(
      gateway,
      actionButton('Preview discovery JSON', async () => {
        await runBusy(async () => {
          const result = await window.portreeveDesktop.previewStackSnapshot(
            stack.activation.id,
            component.name,
            gateway.value,
          );
          snapshotJson = JSON.stringify(snapshotDocument(result), null, 2);
          requiredElement('snapshot-content').textContent = snapshotJson;
          snapshotDialog.showModal();
        });
      }),
    );
    body.append(definitionList, addresses, snapshotControls);
  } else {
    body.append(definitionList, addresses);
  }
  details.append(summary, body);
  return details;
}

/** @param {any} endpoint */
function addressLine(endpoint) {
  const row = document.createElement('div');
  row.className = 'address-row';
  const label = document.createElement('span');
  label.textContent = `${endpoint.alias} (${endpoint.component}.${endpoint.endpoint})`;
  const address = `${endpoint.host.host}:${endpoint.host.port}`;
  const value = document.createElement('code');
  value.textContent = address;
  row.append(
    label,
    value,
    actionButton('Copy', () => copyText(address)),
  );
  if (endpoint.dockerNetwork !== null) {
    const dockerAddress = `${endpoint.dockerNetwork.host}:${endpoint.dockerNetwork.port}`;
    const dockerValue = document.createElement('code');
    dockerValue.textContent = dockerAddress;
    row.append(
      dockerValue,
      actionButton('Copy Docker', () => copyText(dockerAddress)),
    );
  }
  return row;
}

async function previewStackPrune() {
  await runBusy(async () => {
    const preview = await window.portreeveDesktop.previewStackPrune();
    requiredElement('stack-prune-summary').textContent =
      `${preview.candidates.length} stack${preview.candidates.length === 1 ? '' : 's'} older than ${preview.olderThanDays} days with missing stack roots can be removed.`;
    requiredElement('stack-prune-candidates').replaceChildren(
      ...preview.candidates.map((/** @type {any} */ candidate) => {
        const item = document.createElement('li');
        item.textContent = `${candidate.project} (${candidate.stackRootName}) — ${candidate.claimCount} claim${candidate.claimCount === 1 ? '' : 's'}`;
        return item;
      }),
    );
    const blocked = requiredElement('stack-prune-blocked');
    blocked.replaceChildren(
      ...preview.blocked.map((/** @type {any} */ entry) =>
        paragraph(
          `${entry.project} (${entry.stackRootName}): ${entry.reasons.join('; ')}`,
        ),
      ),
    );
    blocked.hidden = preview.blocked.length === 0;
    stackPruneConfirmation.value = '';
    stackPruneConfirmation.disabled = preview.candidates.length === 0;
    stackPruneAccept.disabled = true;
    stackPruneDialog.showModal();
    if ((await dialogResult(stackPruneDialog)) !== 'confirm') return;
    const result = await window.portreeveDesktop.executeStackPrune(
      stackPruneConfirmation.value,
    );
    render(result.snapshot);
    showOperation(result.message, [
      `Outcome: ${result.outcome}`,
      `Deleted stacks: ${result.deletedStacks}`,
      `Deleted claims: ${result.deletedClaims}`,
      ...result.skipped.map(
        (/** @type {any} */ entry) => `Skipped ${entry.stackId}: ${entry.reason}`,
      ),
    ]);
  });
}

/** @param {string} label @param {() => void|Promise<void>} invoke @param {string} [className] */
function actionButton(label, invoke, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = className;
  button.disabled = busy;
  button.addEventListener('click', invoke);
  return button;
}

/** @param {any} snapshot */
function snapshotDocument(snapshot) {
  const endpointMap = (/** @type {any[]} */ entries) =>
    Object.fromEntries(
      entries.map((entry) => [
        entry.alias,
        {
          component: entry.component,
          endpoint: entry.endpoint,
          address: entry.host,
        },
      ]),
    );
  return {
    schemaVersion: snapshot.schemaVersion,
    definitionRevision: snapshot.definitionRevision,
    generationId: snapshot.generationId,
    activationId: snapshot.activationId,
    component: snapshot.component,
    own: endpointMap(snapshot.own),
    dependencies: endpointMap(snapshot.dependencies),
  };
}

/** @param {string} value */
async function copyText(value) {
  try {
    await window.portreeveDesktop.copyText(value);
    showOperation('Copied to the clipboard.', []);
  } catch {
    showOperation('Clipboard access was unavailable.', [
      'Select the visible value and copy it manually.',
    ]);
  }
}

/** @param {string} value */
function shortId(value) {
  return value.slice(0, 12);
}

/** @param {any} listener */
function listenerDetail(listener) {
  const article = document.createElement('article');
  const heading = document.createElement('h5');
  heading.textContent = `PID ${listener.pid} — ${listener.verified ? 'verified owner' : 'unverified'}`;
  const details = document.createElement('dl');
  details.className = 'definitions detail-definitions';
  details.append(
    definition('Listener address', listener.names.join(', ') || 'Unknown'),
    definition('Ownership evidence', listener.reason),
    definition('Lineage', listener.lineage.join(' → ') || 'Unavailable'),
    definition(
      'Parent PID',
      listener.process ? String(listener.process.parentPid) : '—',
    ),
    definition('UID', listener.process ? String(listener.process.uid) : '—'),
    definition('Started', listener.process?.startTime ?? '—'),
    definition('Executable', listener.process?.executableName ?? '—'),
    definition('Working directory', listener.process?.workingDirectory ?? '—'),
  );
  article.append(heading, details);
  return article;
}

/** @param {any} lifecycle @param {string[]} actions */
function actionGuidance(lifecycle, actions) {
  if (lifecycle === null) return 'Lifecycle evidence is unavailable. Refresh to retry.';
  if (lifecycle.mode === 'ambiguous') {
    return 'Execution mode is ambiguous. Mutations are withheld until the evidence is clear.';
  }
  if (lifecycle.installation.state === 'invalid') {
    return 'The managed installation is invalid. Review lifecycle evidence before changing it.';
  }
  if (actions.length === 0) return 'No service action is currently needed.';
  return 'Available actions reflect fresh lifecycle evidence and are revalidated by the CLI.';
}

/** @param {Element} tab @param {string|undefined} view */
function activateTab(tab, view) {
  for (const candidate of document.querySelectorAll('.tab')) {
    candidate.classList.toggle('active', candidate === tab);
  }
  requiredElement('overview').hidden = view !== 'overview';
  requiredElement('ports').hidden = view !== 'ports';
  requiredElement('stacks').hidden = view !== 'stacks';
}

/** @param {string} reason */
function overwriteMessage(reason) {
  if (reason === 'invalid-file-replacement') {
    return 'The existing invalid portreeve.stack.json will be replaced by this validated draft. This cannot be merged automatically.';
  }
  if (reason === 'appeared-after-open') {
    return 'A portreeve.stack.json file appeared after this draft opened. Overwrite replaces that unseen file; Cancel keeps editing without writing.';
  }
  return 'portreeve.stack.json changed outside PortReeve after this editor opened. Overwrite replaces the newly observed bytes; Cancel keeps editing without writing.';
}

/** @param {string} title @param {string} message @param {string} acceptLabel */
async function confirmAction(title, message, acceptLabel) {
  requiredElement('confirmation-title').textContent = title;
  requiredElement('confirmation-message').textContent = message;
  requiredElement('confirmation-accept').textContent = acceptLabel;
  confirmationDialog.showModal();
  return (await dialogResult(confirmationDialog)) === 'confirm';
}

/** @param {HTMLDialogElement} dialog */
function dialogResult(dialog) {
  return new Promise((resolvePromise) => {
    dialog.addEventListener('close', () => resolvePromise(dialog.returnValue), {
      once: true,
    });
  });
}

/** @param {() => Promise<void>} work */
async function runBusy(work) {
  if (busy) return;
  busy = true;
  setControlsDisabled(true);
  try {
    await work();
  } catch (error) {
    showOperation('The operation could not be completed.', [
      error instanceof Error && error.message.trim() !== ''
        ? error.message
        : 'Refresh PortReeve evidence, then try again.',
    ]);
  } finally {
    busy = false;
    setControlsDisabled(false);
    renderActions();
    renderStacks();
  }
}

/** @param {boolean} disabled */
function setControlsDisabled(disabled) {
  for (const control of document.querySelectorAll('button, input')) {
    if (control.closest('dialog')) continue;
    /** @type {HTMLButtonElement|HTMLInputElement} */ (control).disabled = disabled;
  }
}

/** @param {string} message @param {string[]} details */
function showOperation(message, details) {
  operationMessage.textContent = message;
  operationDetails.replaceChildren(
    ...details.map((detail) => {
      const item = document.createElement('li');
      item.textContent = detail;
      return item;
    }),
  );
  operationResult.hidden = false;
}

/** @param {any} error */
function errorItem(error) {
  const item = document.createElement('li');
  item.textContent = error.message;
  return item;
}

/** @param {string} label @param {string} value */
function card(label, value) {
  const article = document.createElement('article');
  article.className = 'status-card';
  const heading = document.createElement('h3');
  heading.textContent = label;
  const content = document.createElement('p');
  content.textContent = value;
  article.append(heading, content);
  return article;
}

/** @param {string} label @param {string} value */
function definition(label, value) {
  const wrapper = document.createElement('div');
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = value;
  wrapper.append(term, description);
  return wrapper;
}

/** @param {string} value */
function cell(value) {
  const element = document.createElement('td');
  element.textContent = value;
  return element;
}

/** @param {string} value */
function paragraph(value) {
  const element = document.createElement('p');
  element.textContent = value;
  return element;
}

/** @param {string} timestamp */
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** @param {number} size */
function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** @param {string} id */
function requiredElement(id) {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing renderer element ${id}.`);
  return element;
}
