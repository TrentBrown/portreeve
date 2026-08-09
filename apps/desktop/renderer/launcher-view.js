// @ts-check

import {
  buildLauncherDefinition,
  createLauncherDraft,
  launcherAvailability,
  launcherDraftSignature,
  launcherEnvironmentPreview,
} from './launcher-model.js';

/** @type {Readonly<Record<string, string>>} */
const OPERATION_LABELS = Object.freeze({
  start: 'Start',
  stop: 'Stop',
  restart: 'Restart',
  status: 'Status',
});

/**
 * @param {{
 *  browser: HTMLElement,
 *  editor: HTMLElement,
 *  list: HTMLElement,
 *  detail: HTMLElement,
 *  api: any,
 *  confirm: (title: string, message: string, accept: string) => Promise<boolean>,
 *  confirmDiscard: () => Promise<boolean>,
 *  onOperation: (message: string, details: string[]) => void,
 *  onOpenStack: (stackId: string) => void,
 * }} options
 */
export function createLauncherView(options) {
  /** @type {any|null} */
  let snapshot = null;
  /** @type {any[]} */
  let stacks = [];
  /** @type {string|null} */
  let selectedStackId = null;
  /** @type {Map<string, any>} */
  const documents = new Map();
  /** @type {Map<string, any>} */
  const sessions = new Map();
  /** @type {any|null} */
  let editorState = null;

  options.api.subscribeLauncherOutput((/** @type {any} */ event) => {
    const session = sessions.get(event.stackId);
    if (session?.sessionId !== event.sessionId) return;
    void options.api
      .getLauncherOutput(event.sessionId)
      .then((/** @type {any} */ output) => {
        sessions.set(event.stackId, { ...session, output });
        renderDetail();
      });
  });
  options.api.subscribeLauncherSessions((/** @type {any} */ event) => {
    const prior = sessions.get(event.stackId);
    sessions.set(event.stackId, {
      ...prior,
      ...event,
      output: prior?.output ?? emptyOutput(event),
    });
    if (event.state === 'terminal') {
      void settleSession(event);
    } else {
      renderDetail();
    }
  });

  async function refresh() {
    setBusy(true);
    try {
      snapshot = await options.api.getLauncherSnapshot();
      if (
        selectedStackId === null ||
        !snapshot.launchers.some(
          (/** @type {any} */ entry) => entry.stackId === selectedStackId,
        )
      ) {
        selectedStackId = snapshot.launchers[0]?.stackId ?? null;
      }
      await ensureDocument(selectedStackId);
      renderBrowser();
    } catch (error) {
      options.onOperation('Launcher evidence is unavailable.', [safeMessage(error)]);
    } finally {
      setBusy(false);
    }
  }

  /** @param {string|null} [stackId] */
  async function open(stackId = null) {
    options.browser.hidden = false;
    options.editor.hidden = true;
    if (stackId !== null) selectedStackId = stackId;
    await refresh();
  }

  /** @param {string} stackId */
  async function select(stackId) {
    selectedStackId = stackId;
    await ensureDocument(stackId);
    renderBrowser();
  }

  async function requestClose() {
    if (!isDirty()) {
      closeEditor();
      return true;
    }
    if (!(await options.confirmDiscard())) return false;
    closeEditor();
    return true;
  }

  function closeEditor() {
    editorState = null;
    options.editor.hidden = true;
    options.browser.hidden = false;
    renderBrowser();
  }

  function isDirty() {
    return (
      editorState !== null &&
      launcherDraftSignature(editorState.draft) !== editorState.baseline
    );
  }

  /** @param {string|null} stackId */
  async function ensureDocument(stackId) {
    if (stackId === null || documents.has(stackId)) return;
    try {
      documents.set(stackId, await options.api.openLauncherDocument(stackId));
    } catch (error) {
      documents.set(stackId, { loadError: safeMessage(error) });
    }
  }

  function renderBrowser() {
    if (snapshot === null || !options.editor.hidden) return;
    options.list.replaceChildren(
      ...(snapshot.launchers.length === 0
        ? [emptyState('No applied stacks are available for launcher setup.')]
        : snapshot.launchers.map((/** @type {any} */ summary) =>
            launcherCard(summary),
          )),
    );
    renderDetail();
  }

  /** @param {any} summary */
  function launcherCard(summary) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'launcher-card';
    button.classList.toggle('selected', summary.stackId === selectedStackId);
    const title = document.createElement('strong');
    title.textContent = summary.project;
    const root = document.createElement('span');
    root.textContent = summary.stackRootName;
    const state = document.createElement('span');
    state.className = `badge state-${launcherState(summary)}`;
    state.textContent = launcherState(summary);
    const maturity = document.createElement('small');
    maturity.textContent =
      summary.integrationMode === null
        ? 'Not configured'
        : summary.integrationMode.replace('-', ' ');
    button.append(title, root, state, maturity);
    button.addEventListener('click', () => void select(summary.stackId));
    return button;
  }

  function renderDetail() {
    if (snapshot === null || !options.editor.hidden) return;
    const summary = snapshot.launchers.find(
      (/** @type {any} */ entry) => entry.stackId === selectedStackId,
    );
    if (summary === undefined) {
      options.detail.replaceChildren(
        heading('Launcher details'),
        muted('Select a stack to configure or operate its launcher.'),
      );
      return;
    }
    const stack =
      stacks.find((/** @type {any} */ entry) => entry.id === summary.stackId) ?? null;
    const documentState = documents.get(summary.stackId) ?? null;
    if (documentState?.loadError !== undefined) {
      options.detail.replaceChildren(
        heading(summary.project),
        errorPanel(documentState.loadError),
      );
      return;
    }
    const session = sessions.get(summary.stackId) ?? null;
    const maturity = document.createElement('div');
    maturity.className = 'launcher-maturity';
    maturity.append(
      heading(
        summary.integrationMode === 'verified-activation'
          ? 'Verified activation'
          : 'Command-only integration',
        4,
      ),
      paragraph(
        summary.integrationMode === 'verified-activation'
          ? 'Success requires matching activation and listener evidence for the exact allocation generation.'
          : 'Project command results remain advisory. Adopt the activation callback protocol to verify ownership.',
      ),
    );
    const facts = definitionList([
      ['Stack root', summary.stackRootName],
      ['Definition', summary.fileState],
      ['Trust', summary.trusted ? 'Exact revision trusted' : 'Not trusted'],
      ['Start mode', summary.startMode ?? 'Not configured'],
      ['Evidence', evidenceText(summary.evidence)],
      ['Revision', summary.revision?.slice(0, 12) ?? '—'],
    ]);
    const actions = document.createElement('div');
    actions.className = 'actions launcher-actions';
    actions.append(
      button(
        summary.fileState === 'missing' ? 'Set up launcher' : 'Edit launcher',
        () => void openEditor(summary.stackId),
        'primary',
      ),
      button('Edit stack definition', () => options.onOpenStack(summary.stackId)),
    );
    const availability = launcherAvailability(summary, documentState, session);
    for (const operation of availability.actions) {
      const launcherOperation = /** @type {'start'|'stop'|'restart'|'status'} */ (
        operation
      );
      actions.append(
        button(
          OPERATION_LABELS[launcherOperation] ?? launcherOperation,
          () => void runOperation(summary, launcherOperation),
        ),
      );
    }
    if (session?.state === 'running') {
      actions.append(
        button('Cancel operation', () => void cancelSession(session), 'danger'),
      );
      if (
        session.operation === 'start' &&
        documentState?.definition?.operations.start.mode === 'attached'
      ) {
        actions.append(
          button(
            'Terminate attached command',
            () => void terminateAttached(summary.stackId),
            'danger',
          ),
        );
      }
    }
    const reasons = availability.reasons.map(muted);
    const staleEvidence = snapshot.stale
      ? errorPanel(
          'Launcher evidence may be stale. Refresh before relying on current state or action availability.',
        )
      : null;
    const launcherError =
      summary.error === null
        ? null
        : errorPanel(`${summary.error.code}: ${summary.error.message}`);
    const environment = renderEnvironmentPreview(documentState?.definition, stack);
    const output = renderOutput(session);
    const history = renderHistory(summary.history);
    options.detail.replaceChildren(
      heading(summary.project),
      paragraph(
        'PortReeve supplies addresses and independent evidence; the checked-in launcher owns project lifecycle commands.',
      ),
      maturity,
      facts,
      ...(staleEvidence === null ? [] : [staleEvidence]),
      ...(launcherError === null ? [] : [launcherError]),
      actions,
      ...reasons,
      environment,
      output,
      history,
    );
  }

  /** @param {any} summary @param {'start'|'stop'|'restart'|'status'} operation */
  async function runOperation(summary, operation) {
    let runStartAnyway = false;
    let allowDegraded = false;
    if (
      ['start', 'restart'].includes(operation) &&
      summary.evidence?.classification === 'partial'
    ) {
      runStartAnyway = await options.confirm(
        `${OPERATION_LABELS[operation]} with partial evidence?`,
        'Some assigned endpoints are already listening while others are not. The project launcher may repair this state, but the result is not predictable from current evidence alone.',
        `${OPERATION_LABELS[operation]} anyway`,
      );
      if (!runStartAnyway) return;
    }
    if (
      ['stop', 'status'].includes(operation) &&
      ['cached', 'local'].includes(summary.evidence?.source)
    ) {
      allowDegraded = await options.confirm(
        `Use degraded evidence for ${OPERATION_LABELS[operation]}?`,
        'The PortReeve service is unavailable. This operation will use clearly stale local or cached allocation context.',
        `Continue with ${OPERATION_LABELS[operation]}`,
      );
      if (!allowDegraded) return;
    }
    setBusy(true);
    try {
      const session = await options.api.beginLauncherAction(
        summary.stackId,
        operation,
        runStartAnyway,
        allowDegraded,
      );
      sessions.set(summary.stackId, session);
      options.onOperation(
        `${OPERATION_LABELS[operation]} began for ${summary.project}.`,
        ['Output and independent evidence remain available in Launcher.'],
      );
      renderDetail();
    } catch (error) {
      options.onOperation(`${OPERATION_LABELS[operation]} could not begin.`, [
        safeMessage(error),
      ]);
    } finally {
      setBusy(false);
    }
  }

  /** @param {any} event */
  async function settleSession(event) {
    const prior = sessions.get(event.stackId);
    let output = prior?.output ?? emptyOutput(event);
    try {
      output = await options.api.getLauncherOutput(event.sessionId);
    } catch {
      // The reduced terminal result remains useful if output was already evicted.
    }
    sessions.set(event.stackId, { ...prior, ...event, output });
    const details = launcherResultDetails(event.result, output);
    options.onOperation(
      `${OPERATION_LABELS[event.operation]} ${event.result?.outcome ?? 'completed'} for ${projectName(event.stackId)}.`,
      details,
    );
    await refresh();
  }

  /** @param {any} session */
  async function cancelSession(session) {
    try {
      await options.api.cancelLauncherSession(session.sessionId);
      options.onOperation('Launcher cancellation requested.', [
        'PortReeve will terminate only the process group owned by this application.',
      ]);
    } catch (error) {
      options.onOperation('Launcher cancellation failed.', [safeMessage(error)]);
    }
  }

  /** @param {string} stackId */
  async function terminateAttached(stackId) {
    try {
      const result = await options.api.terminateLauncherAttached(stackId);
      options.onOperation(
        result.requested
          ? 'Attached launcher termination requested.'
          : 'No attached launcher command was available to terminate.',
        [],
      );
    } catch (error) {
      options.onOperation('Attached launcher termination failed.', [
        safeMessage(error),
      ]);
    }
  }

  /** @param {string} stackId */
  async function openEditor(stackId) {
    await ensureDocument(stackId);
    const documentState = documents.get(stackId);
    if (documentState?.loadError !== undefined) return;
    const draft = createLauncherDraft(documentState);
    editorState = {
      stackId,
      document: documentState,
      draft,
      baseline:
        documentState.fileState === 'missing' ? '' : launcherDraftSignature(draft),
      message: null,
      conflict: false,
    };
    options.browser.hidden = true;
    options.editor.hidden = false;
    renderEditor();
  }

  function renderEditor() {
    if (editorState === null) return;
    const stack =
      stacks.find((/** @type {any} */ entry) => entry.id === editorState.stackId) ??
      null;
    const built = buildLauncherDefinition(editorState.draft, stack);
    const header = document.createElement('div');
    header.className = 'launcher-editor-header';
    header.append(
      button('Back to Launcher', () => void requestClose()),
      sectionHeading(
        `${editorState.document.fileState === 'missing' ? 'Set up' : 'Edit'} ${editorState.document.project}`,
        'Save and Trust writes portreeve.launcher.json atomically and trusts only the exact resulting revision.',
      ),
    );
    const execution = editorSection('Execution');
    execution.append(
      fieldRow([
        selectField(
          'Integration',
          editorState.draft.integrationMode,
          [
            ['command-only', 'Command only'],
            ['verified-activation', 'Verified activation'],
          ],
          (value) => updateDraft('integrationMode', value),
        ),
        selectField(
          'Shell',
          editorState.draft.shell,
          [
            ['system', 'Account shell'],
            ['bash', 'Bash'],
            ['zsh', 'Zsh'],
          ],
          (value) => updateDraft('shell', value),
        ),
        textField('Working directory', editorState.draft.workingDirectory, (value) =>
          updateDraft('workingDirectory', value),
        ),
        selectField(
          'Start lifetime',
          editorState.draft.start.mode,
          [
            ['finite', 'Finite command'],
            ['attached', 'Attached foreground command'],
          ],
          (value) => {
            editorState.draft.start.mode = value;
            if (value === 'attached') editorState.draft.restart.enabled = false;
            renderEditor();
          },
        ),
      ]),
    );
    const commands = editorSection('Commands');
    commands.append(
      commandEditor('start', editorState.draft.start, true),
      commandEditor('stop', editorState.draft.stop, true),
      commandEditor('restart', editorState.draft.restart, false),
      commandEditor('status', editorState.draft.status, false),
    );
    const environment = editorSection('Endpoint environment');
    environment.append(
      paragraph(
        'Mappings are resolved from the selected stack generation at operation time. Assigned port numbers are never written to this file.',
      ),
      ...editorState.draft.environment.map((/** @type {any} */ mapping) =>
        environmentEditor(mapping, stack),
      ),
      button('Add environment mapping', () => {
        editorState.draft.environment.push({
          id: `environment-${editorState.draft.nextIdentity}`,
          name: '',
          component: stack?.components[0]?.name ?? '',
          endpoint: stack?.components[0]?.endpoints[0]?.name ?? 'default',
          value: 'host-port',
          scheme: 'http',
        });
        editorState.draft.nextIdentity += 1;
        renderEditor();
      }),
    );
    const advanced = editorSection('Advanced');
    advanced.append(
      paragraph(
        'Trust covers these visible launcher bytes. It does not sandbox scripts, dependencies, shell profiles, or programs invoked indirectly by a command.',
      ),
      provenance(editorState.document.suggestions),
    );
    const review = editorSection('Review');
    const preview = document.createElement('pre');
    preview.className = 'launcher-json';
    preview.textContent = built.content;
    review.append(
      paragraph('Exact canonical launcher preview:'),
      preview,
      renderEnvironmentPreview(built.definition, stack),
    );
    const validation = document.createElement('div');
    validation.className =
      built.issues.length === 0 ? 'editor-status info' : 'editor-validation';
    validation.replaceChildren(
      heading(built.issues.length === 0 ? 'Ready to save' : 'Review required', 3),
      ...(built.issues.length === 0
        ? [
            paragraph(
              'The draft is locally valid. Electron main will revalidate it against the current stack and filesystem evidence.',
            ),
          ]
        : [list(built.issues.map((issue) => issue.message))]),
    );
    if (editorState.message !== null) validation.append(paragraph(editorState.message));
    const controls = document.createElement('div');
    controls.className = 'stack-editor-actions';
    controls.append(
      paragraph(isDirty() ? 'Unsaved launcher changes.' : 'No unsaved changes.'),
      button('Cancel', () => void requestClose()),
      button(
        'Save and Trust',
        () => void saveEditor(false),
        'primary',
        built.issues.length > 0 || !isDirty(),
      ),
    );
    if (editorState.conflict) {
      controls.append(
        button('Review external version', () => void reloadEditor()),
        button('Overwrite external version', () => void saveEditor(true), 'danger'),
      );
    }
    options.editor.replaceChildren(
      header,
      execution,
      commands,
      environment,
      advanced,
      review,
      validation,
      controls,
    );
  }

  /** @param {'start'|'stop'|'restart'|'status'} operation @param {any} state @param {boolean} required */
  function commandEditor(operation, state, required) {
    const article = document.createElement('article');
    article.className = 'launcher-command';
    const title = heading(OPERATION_LABELS[operation] ?? operation, 4);
    if (!required) {
      title.prepend(
        checkbox(
          state.enabled,
          (checked) => {
            state.enabled = checked;
            renderEditor();
          },
          `${OPERATION_LABELS[operation]} command enabled`,
        ),
      );
    }
    const command = document.createElement('textarea');
    command.rows = 3;
    command.value = state.command;
    command.disabled = !required && !state.enabled;
    command.setAttribute('aria-label', `${OPERATION_LABELS[operation]} command`);
    command.addEventListener('input', () => {
      state.command = command.value;
      updateReviewOnly();
    });
    article.append(title, command);
    const candidates =
      editorState.document.suggestions.operations[operation].candidates;
    if (candidates.length > 0) {
      const suggestions = document.createElement('div');
      suggestions.className = 'launcher-suggestions';
      suggestions.append(paragraph('Manifest suggestions:'));
      for (const candidate of candidates) {
        suggestions.append(
          button(
            `${candidate.command} — ${candidate.provenance.kind} in ${candidate.provenance.filename}`,
            () => {
              state.command = candidate.command;
              if (!required) state.enabled = true;
              renderEditor();
            },
            'small',
          ),
        );
      }
      article.append(suggestions);
    }
    if (!(operation === 'start' && editorState.draft.start.mode === 'attached')) {
      article.append(
        numberField('Timeout seconds', state.timeoutSeconds, (value) => {
          state.timeoutSeconds = value;
          updateReviewOnly();
        }),
      );
    }
    return article;
  }

  /** @param {any} mapping @param {any} stack */
  function environmentEditor(mapping, stack) {
    const article = document.createElement('article');
    article.className = 'launcher-environment-record';
    const components = stack?.components ?? [];
    const component = components.find(
      (/** @type {any} */ entry) => entry.name === mapping.component,
    );
    article.append(
      fieldRow([
        textField('Variable name', mapping.name, (value) => {
          mapping.name = value;
          updateReviewOnly();
        }),
        selectField(
          'Component',
          mapping.component,
          components.map((/** @type {any} */ entry) => [entry.name, entry.name]),
          (value) => {
            mapping.component = value;
            mapping.endpoint =
              components.find((/** @type {any} */ entry) => entry.name === value)
                ?.endpoints[0]?.name ?? 'default';
            renderEditor();
          },
        ),
        selectField(
          'Endpoint',
          mapping.endpoint,
          (component?.endpoints ?? []).map((/** @type {any} */ entry) => [
            entry.name,
            entry.name,
          ]),
          (value) => {
            mapping.endpoint = value;
            updateReviewOnly();
          },
        ),
        selectField(
          'Value',
          mapping.value,
          [
            ['host-port', 'Host port'],
            ['host-url', 'Host URL'],
            ['container-port', 'Container port'],
            ['docker-network-url', 'Docker-network URL'],
          ],
          (value) => {
            mapping.value = value;
            renderEditor();
          },
        ),
        ...(['host-url', 'docker-network-url'].includes(mapping.value)
          ? [
              selectField(
                'Scheme',
                mapping.scheme,
                [
                  ['http', 'http'],
                  ['https', 'https'],
                ],
                (value) => {
                  mapping.scheme = value;
                  updateReviewOnly();
                },
              ),
            ]
          : []),
      ]),
      button(
        'Remove mapping',
        () => {
          editorState.draft.environment = editorState.draft.environment.filter(
            (/** @type {any} */ entry) => entry.id !== mapping.id,
          );
          renderEditor();
        },
        'danger small',
      ),
    );
    return article;
  }

  function updateReviewOnly() {
    if (editorState === null) return;
    renderEditor();
  }

  /** @param {string} key @param {string} value */
  function updateDraft(key, value) {
    editorState.draft[key] = value;
    updateReviewOnly();
  }

  /** @param {boolean} overwrite */
  async function saveEditor(overwrite) {
    if (editorState === null) return;
    const stack =
      stacks.find((/** @type {any} */ entry) => entry.id === editorState.stackId) ??
      null;
    const built = buildLauncherDefinition(editorState.draft, stack);
    if (built.issues.length > 0) return;
    const previousMode = editorState.document.definition?.integration.mode;
    const confirmDowngrade =
      previousMode === 'verified-activation' &&
      built.definition.integration.mode === 'command-only'
        ? await options.confirm(
            'Downgrade verified activation?',
            'Command-only integration no longer requires the project activation callback to prove ownership. Saving creates and trusts a new weaker revision.',
            'Downgrade and Save',
          )
        : false;
    if (
      previousMode === 'verified-activation' &&
      built.definition.integration.mode === 'command-only' &&
      !confirmDowngrade
    ) {
      return;
    }
    if (
      editorState.document.fileState === 'invalid' &&
      !overwrite &&
      !(await options.confirm(
        'Overwrite the invalid launcher file?',
        'The existing file cannot be edited safely. PortReeve will replace it only after rechecking current filesystem evidence.',
        'Overwrite invalid file',
      ))
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await options.api.saveLauncherDocument(
        editorState.document.documentId,
        built.definition,
        overwrite || editorState.document.fileState === 'invalid',
        confirmDowngrade,
      );
      if (result.outcome === 'conflict') {
        editorState.conflict = true;
        editorState.message =
          'The project file changed outside PortReeve. Review it, explicitly overwrite it, or cancel.';
        renderEditor();
        return;
      }
      if (result.outcome !== 'saved-and-trusted' || result.document === null) {
        editorState.message = `${result.error?.code ?? 'launcher_save_failed'}: ${result.error?.message ?? result.message}`;
        renderEditor();
        return;
      }
      documents.set(editorState.stackId, result.document);
      const draft = createLauncherDraft(result.document);
      editorState.document = result.document;
      editorState.draft = draft;
      editorState.baseline = launcherDraftSignature(draft);
      editorState.conflict = false;
      editorState.message = 'Saved and trusted the exact launcher revision.';
      options.onOperation(result.message, [
        `Revision: ${result.document.revision?.slice(0, 12)}`,
      ]);
      await refresh();
      options.browser.hidden = true;
      options.editor.hidden = false;
      renderEditor();
    } catch (error) {
      editorState.message = safeMessage(error);
      options.onOperation('The launcher definition was not saved or trusted.', [
        safeMessage(error),
      ]);
      renderEditor();
    } finally {
      setBusy(false);
    }
  }

  async function reloadEditor() {
    if (editorState === null) return;
    documents.delete(editorState.stackId);
    await ensureDocument(editorState.stackId);
    await openEditor(editorState.stackId);
  }

  /** @param {any} definition @param {any} stack */
  function renderEnvironmentPreview(definition, stack) {
    const section = document.createElement('section');
    section.className = 'launcher-subsection';
    section.append(heading('Endpoint environment preview', 4));
    const entries = launcherEnvironmentPreview(definition, stack);
    section.append(
      ...(entries.length === 0
        ? [muted('No endpoint environment mappings are configured.')]
        : entries.map((/** @type {any} */ entry) => {
            const row = document.createElement('div');
            row.className = 'launcher-environment-preview';
            const value = document.createElement('code');
            value.textContent = `${entry.name}=${entry.value ?? '<allocated at operation time>'}`;
            row.append(value, muted(`${entry.endpoint}; ${entry.kind}`));
            return row;
          })),
    );
    return section;
  }

  /** @param {any} session */
  function renderOutput(session) {
    const section = document.createElement('section');
    section.className = 'launcher-subsection';
    section.append(heading('Current-session output', 4));
    if (session === null) {
      section.append(muted('Run a launcher operation to see bounded output here.'));
      return section;
    }
    const output = session.output ?? emptyOutput(session);
    const pre = document.createElement('pre');
    pre.className = 'launcher-output';
    pre.textContent = output.chunks
      .map((/** @type {any} */ chunk) => chunk.text)
      .join('');
    if (pre.textContent === '') pre.textContent = '[No output]';
    const controls = document.createElement('div');
    controls.className = 'actions';
    controls.append(
      button('Copy output', () =>
        options.api.copyText(
          output.chunks.map((/** @type {any} */ chunk) => chunk.text).join(''),
        ),
      ),
      button('Save output…', async () => {
        try {
          const result = await options.api.saveLauncherOutput(session.sessionId);
          options.onOperation(
            result.outcome === 'saved'
              ? `Saved launcher output as ${result.filename}.`
              : 'Output save was cancelled.',
            [],
          );
        } catch (error) {
          options.onOperation('Launcher output could not be saved.', [
            safeMessage(error),
          ]);
        }
      }),
    );
    section.append(
      paragraph(
        `${session.state}; ${output.retainedBytes} retained bytes${output.truncated ? '; earlier output truncated' : ''}`,
      ),
      pre,
      controls,
    );
    return section;
  }

  /** @param {any[]} records */
  function renderHistory(records) {
    const section = document.createElement('section');
    section.className = 'launcher-subsection';
    section.append(heading('Recent operation history', 4));
    if (records.length === 0) {
      section.append(muted('No durable launcher operation metadata is available.'));
      return section;
    }
    const listElement = document.createElement('ol');
    listElement.className = 'launcher-history';
    for (const record of records) {
      const item = document.createElement('li');
      item.append(
        paragraph(
          `${OPERATION_LABELS[record.operation]} — ${record.outcome ?? record.state}`,
        ),
        muted(
          `${new Date(record.startedAt).toLocaleString()} · ${record.executionMode}${record.failure ? ` · ${record.failure.code}` : ''}`,
        ),
      );
      listElement.append(item);
    }
    section.append(listElement);
    return section;
  }

  /** @param {any} suggestions */
  function provenance(suggestions) {
    const wrapper = document.createElement('div');
    wrapper.className = 'launcher-provenance';
    wrapper.append(heading('Manifest provenance', 4));
    if (suggestions.error !== null) {
      wrapper.append(
        errorPanel(`${suggestions.error.code}: ${suggestions.error.message}`),
      );
    } else if (suggestions.inspectedFiles.length === 0) {
      wrapper.append(
        muted('No supported manifest files were found in the exact working directory.'),
      );
    } else {
      wrapper.append(
        paragraph('Inspected without executing code:'),
        list(suggestions.inspectedFiles),
      );
    }
    return wrapper;
  }

  /** @param {boolean} value */
  function setBusy(value) {
    if (!value) {
      if (options.editor.hidden) renderBrowser();
      else renderEditor();
      for (const control of [options.browser, options.editor].flatMap((root) => [
        ...root.querySelectorAll('[data-launcher-previously-disabled]'),
      ])) {
        const input =
          /** @type {HTMLButtonElement|HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} */ (
            control
          );
        input.disabled = input.dataset.launcherPreviouslyDisabled === 'true';
        delete input.dataset.launcherPreviouslyDisabled;
      }
      return;
    }
    for (const control of options.browser.querySelectorAll('button')) {
      const button = /** @type {HTMLButtonElement} */ (control);
      button.dataset.launcherPreviouslyDisabled = String(button.disabled);
      button.disabled = true;
    }
    for (const control of options.editor.querySelectorAll(
      'button, input, select, textarea',
    )) {
      const input =
        /** @type {HTMLButtonElement|HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} */ (
          control
        );
      input.dataset.launcherPreviouslyDisabled = String(input.disabled);
      input.disabled = true;
    }
  }

  /** @param {any[]} next */
  function setStacks(next) {
    stacks = next;
    if (snapshot !== null) renderDetail();
  }

  /** @param {string} stackId */
  function projectName(stackId) {
    return (
      snapshot?.launchers.find((/** @type {any} */ entry) => entry.stackId === stackId)
        ?.project ?? 'stack'
    );
  }

  return Object.freeze({
    open,
    refresh,
    select,
    setStacks,
    requestClose,
    isOpen: () => editorState !== null,
    isDirty,
  });
}

/** @param {any} summary */
function launcherState(summary) {
  if (summary.fileState !== 'valid') return summary.fileState;
  if (!summary.trusted) return 'untrusted';
  if (summary.attached) return 'active';
  return summary.evidence?.classification ?? 'configured';
}

/** @param {any} evidence */
function evidenceText(evidence) {
  if (evidence === null) return 'Unavailable';
  return `${evidence.classification} (${evidence.source}; ${evidence.listenerCount} listener${evidence.listenerCount === 1 ? '' : 's'})`;
}

/** @param {any} result @param {any} output */
function launcherResultDetails(result, output) {
  if (result === null || result === undefined) return [];
  return [
    `Outcome: ${result.outcome}`,
    ...(result.failure
      ? [`${result.failure.step}: ${result.failure.code}: ${result.failure.message}`]
      : []),
    ...(result.afterEvidence
      ? [`Evidence: ${evidenceText(result.afterEvidence)}`]
      : []),
    ...result.steps.map(
      (/** @type {any} */ step) =>
        `${OPERATION_LABELS[step.step]}: ${step.outcome}${step.exitCode === null ? '' : ` (exit ${step.exitCode})`}`,
    ),
    ...(output.truncated ? ['Earlier output was truncated.'] : []),
  ];
}

/** @param {any} session */
function emptyOutput(session) {
  return {
    schemaVersion: 1,
    sessionId: session.sessionId,
    stackId: session.stackId,
    operation: session.operation,
    chunks: [],
    truncated: false,
    retainedBytes: 0,
    totalBytes: 0,
  };
}

/** @param {string} title @param {number} [level] */
function heading(title, level = 3) {
  const element = document.createElement(`h${level}`);
  element.textContent = title;
  return element;
}

/** @param {string} title @param {string} description */
function sectionHeading(title, description) {
  const wrapper = document.createElement('div');
  wrapper.append(heading(title, 2), paragraph(description));
  return wrapper;
}

/** @param {string} title */
function editorSection(title) {
  const section = document.createElement('section');
  section.className = 'panel launcher-editor-section';
  section.append(heading(title, 3));
  return section;
}

/** @param {Array<[string,string]>} entries */
function definitionList(entries) {
  const dl = document.createElement('dl');
  dl.className = 'definitions';
  for (const [label, value] of entries) {
    const wrapper = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    wrapper.append(dt, dd);
    dl.append(wrapper);
  }
  return dl;
}

/** @param {string} value */
function paragraph(value) {
  const p = document.createElement('p');
  p.textContent = value;
  return p;
}

/** @param {string} value */
function muted(value) {
  const p = paragraph(value);
  p.className = 'muted';
  return p;
}

/** @param {string} value */
function errorPanel(value) {
  const p = paragraph(value);
  p.className = 'editor-status error';
  return p;
}

/** @param {string[]} entries */
function list(entries) {
  const ul = document.createElement('ul');
  for (const entry of entries) {
    const li = document.createElement('li');
    li.textContent = entry;
    ul.append(li);
  }
  return ul;
}

/** @param {string} value */
function emptyState(value) {
  const panel = document.createElement('div');
  panel.className = 'panel empty-state';
  panel.append(paragraph(value));
  return panel;
}

/** @param {string} label @param {() => void|Promise<void>} invoke @param {string} [className] @param {boolean} [disabled] */
function button(label, invoke, className = '', disabled = false) {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = label;
  control.className = className;
  control.disabled = disabled;
  control.addEventListener('click', invoke);
  return control;
}

/** @param {HTMLElement[]} fields */
function fieldRow(fields) {
  const row = document.createElement('div');
  row.className = 'editor-field-grid';
  row.append(...fields);
  return row;
}

/** @param {string} label @param {string} value @param {(value: string) => void} update */
function textField(label, value, update) {
  const wrapper = fieldWrapper(label);
  const input = document.createElement('input');
  input.type = 'text';
  associateLabel(wrapper, input);
  input.value = value;
  input.addEventListener('input', () => update(input.value));
  wrapper.append(input);
  return wrapper;
}

/** @param {string} label @param {string} value @param {(value: string) => void} update */
function numberField(label, value, update) {
  const wrapper = fieldWrapper(label);
  const input = document.createElement('input');
  input.type = 'number';
  associateLabel(wrapper, input);
  input.min = '1';
  input.max = '86400';
  input.value = value;
  input.addEventListener('input', () => update(input.value));
  wrapper.append(input);
  return wrapper;
}

/** @param {string} label @param {string} value @param {Array<[string,string]>} entries @param {(value: string) => void} update */
function selectField(label, value, entries, update) {
  const wrapper = fieldWrapper(label);
  const select = document.createElement('select');
  associateLabel(wrapper, select);
  for (const [optionValue, optionLabel] of entries) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionLabel;
    select.append(option);
  }
  select.value = value;
  select.addEventListener('change', () => update(select.value));
  wrapper.append(select);
  return wrapper;
}

/** @param {string} label */
function fieldWrapper(label) {
  const wrapper = document.createElement('div');
  wrapper.className = 'editor-field';
  const element = document.createElement('label');
  element.textContent = label;
  wrapper.append(element);
  return wrapper;
}

let nextFieldIdentity = 0;

/** @param {HTMLElement} wrapper @param {HTMLInputElement|HTMLSelectElement} control */
function associateLabel(wrapper, control) {
  nextFieldIdentity += 1;
  control.id = `launcher-field-${nextFieldIdentity}`;
  const label = wrapper.querySelector('label');
  if (label instanceof HTMLLabelElement) label.htmlFor = control.id;
}

/** @param {boolean} checked @param {(checked: boolean) => void} update @param {string} [label] */
function checkbox(checked, update, label = 'Enabled') {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('aria-label', label);
  input.checked = checked;
  input.addEventListener('change', () => update(input.checked));
  return input;
}

/** @param {unknown} error */
function safeMessage(error) {
  return error instanceof Error && error.message.trim() !== ''
    ? error.message
    : 'The operation failed without additional details.';
}
