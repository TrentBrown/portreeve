// @ts-check

/** @type {any} */
let snapshot = null;
let filter = '';

const notice = requiredElement('notice');
const errors = requiredElement('errors');
const statusCards = requiredElement('status-cards');
const artifact = requiredElement('artifact');
const portRows = requiredElement('port-rows');
const filterInput = /** @type {HTMLInputElement} */ (requiredElement('port-filter'));

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
  notice.textContent = 'Refreshing…';
  render(await window.portreeveDesktop.refresh());
});
filterInput.addEventListener('input', () => {
  filter = filterInput.value.trim().toLowerCase();
  renderPorts();
});

window.portreeveDesktop.subscribe(render);
render(await window.portreeveDesktop.getSnapshot());

/** @param {any} next */
function render(next) {
  snapshot = next;
  notice.textContent = next.stale
    ? `Evidence may be stale. Last refreshed ${formatTime(next.refreshedAt)}.`
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
  artifact.replaceChildren(
    definition('Version', next.artifact.version),
    definition(
      'Source',
      next.artifact.source === 'published'
        ? 'Published release'
        : 'Local release candidate — not for distribution',
    ),
    definition('Checksum', next.artifact.sha256.slice(0, 12)),
  );
  renderPorts();
}

function renderPorts() {
  if (snapshot === null) return;
  /** @type {any[]} */
  const entries = snapshot.ports;
  const ports = entries.filter((entry) => {
    const label =
      `${entry.port} ${entry.classification} ${entry.claim?.project ?? ''} ${entry.claim?.service ?? ''}`.toLowerCase();
    return label.includes(filter);
  });
  portRows.replaceChildren(
    ...ports.map((entry) => {
      const row = document.createElement('tr');
      row.append(
        cell(String(entry.port)),
        cell(entry.classification),
        cell(
          entry.claim === null
            ? '—'
            : `${entry.claim.project} / ${entry.claim.service} (${entry.claim.workspaceName})`,
        ),
        cell(entry.listeners.map(listenerPid).join(', ') || '—'),
      );
      return row;
    }),
  );
}

/** @param {any} listener */
function listenerPid(listener) {
  return String(listener.pid);
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

/** @param {string} timestamp */
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** @param {string} id */
function requiredElement(id) {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing renderer element ${id}.`);
  return element;
}
