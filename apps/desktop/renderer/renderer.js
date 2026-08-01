// @ts-check

import { availableActions } from './state.js';

/** @type {any} */
let snapshot = null;
let filter = '';
/** @type {number|null} */
let selectedPort = null;
let busy = false;

const notice = requiredElement('notice');
const errors = requiredElement('errors');
const statusCards = requiredElement('status-cards');
const versions = requiredElement('versions');
const serviceActions = requiredElement('service-actions');
const guidance = requiredElement('action-guidance');
const portRows = requiredElement('port-rows');
const portDetail = requiredElement('port-detail');
const operationResult = requiredElement('operation-result');
const operationMessage = requiredElement('operation-message');
const operationDetails = requiredElement('operation-details');
const filterInput = /** @type {HTMLInputElement} */ (requiredElement('port-filter'));
const confirmationDialog = /** @type {HTMLDialogElement} */ (
  requiredElement('confirmation-dialog')
);
const purgeDialog = /** @type {HTMLDialogElement} */ (requiredElement('purge-dialog'));
const purgeConfirmation = /** @type {HTMLInputElement} */ (
  requiredElement('purge-confirmation')
);
const purgeAccept = /** @type {HTMLButtonElement} */ (requiredElement('purge-accept'));

/** @type {Readonly<Record<string, {label: string, title?: string, message?: string, confirm: boolean}>>} */
const actionDefinitions = Object.freeze({
  installAndStart: {
    label: 'Install and Start Portreeve',
    title: 'Install and start Portreeve?',
    message:
      'This installs the bundled CLI under your user account, configures native supervision, and starts the service.',
    confirm: true,
  },
  start: { label: 'Start', confirm: false },
  stop: { label: 'Stop', confirm: false },
  restart: { label: 'Restart', confirm: false },
  stopManual: {
    label: 'Stop manual server',
    title: 'Stop the manual Portreeve server?',
    message:
      'This asks the independently started Portreeve server to stop. It does not adopt it into supervision.',
    confirm: true,
  },
  upgrade: {
    label: 'Upgrade managed service',
    title: 'Upgrade the managed Portreeve service?',
    message:
      'This replaces the managed CLI with the verified bundled version. Portreeve refuses downgrades and unsafe states.',
    confirm: true,
  },
});

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    for (const candidate of document.querySelectorAll('.tab')) {
      candidate.classList.toggle('active', candidate === tab);
    }
    const view = /** @type {HTMLElement} */ (tab).dataset.view;
    requiredElement('overview').hidden = view !== 'overview';
    requiredElement('ports').hidden = view !== 'ports';
  });
}

requiredElement('refresh').addEventListener('click', async () => {
  await runBusy(async () => {
    notice.textContent = 'Refreshing…';
    render(await window.portreeveDesktop.refresh());
  });
});
requiredElement('uninstall').addEventListener('click', async () => {
  if (
    !(await confirmAction(
      'Uninstall the Portreeve service?',
      'Native supervision and the managed executable will be removed. Claims, history, and settings will be preserved.',
      'Uninstall service',
    ))
  ) {
    return;
  }
  await invokeLifecycle('uninstall');
});
requiredElement('preview-purge').addEventListener('click', previewPurge);
filterInput.addEventListener('input', () => {
  filter = filterInput.value.trim().toLowerCase();
  renderPorts();
});
purgeConfirmation.addEventListener('input', () => {
  purgeAccept.disabled = purgeConfirmation.value !== 'DELETE';
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
  renderActions();
  renderPorts();
  setControlsDisabled(busy);
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
  uninstall.disabled =
    busy ||
    snapshot.lifecycle?.installation.state !== 'installed' ||
    ['manual', 'ambiguous'].includes(snapshot.lifecycle.mode) ||
    snapshot.errors.some((/** @type {any} */ error) => error.source === 'lifecycle');
}

/** @param {string} name */
async function invokeLifecycle(name) {
  await runBusy(async () => {
    const result = await /** @type {any} */ (window.portreeveDesktop)[name]();
    render(result.snapshot);
    showOperation(result.message, [
      `Outcome: ${result.outcome}`,
      ...result.steps.map(
        (/** @type {any} */ step) =>
          `${step.operation}: ${step.outcome}${step.errorCode ? ` (${step.errorCode})` : ''}`,
      ),
    ]);
  });
}

async function previewPurge() {
  await runBusy(async () => {
    const preview = await window.portreeveDesktop.previewPurge();
    requiredElement('purge-summary').textContent = preview.allowed
      ? `${preview.paths.length} paths beneath ${preview.root} are eligible for deletion.`
      : 'Portreeve refused this reset preview. Review the evidence below.';
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
  } catch {
    showOperation('The operation could not be completed.', [
      'Refresh Portreeve evidence, then try again.',
    ]);
  } finally {
    busy = false;
    setControlsDisabled(false);
    renderActions();
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
