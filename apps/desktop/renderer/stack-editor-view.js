// @ts-check

import {
  addDraftComponent,
  addDraftDependency,
  addDraftEndpoint,
  createEmptyStackDraft,
  deleteDraftDependency,
  deleteDraftTarget,
  evaluateStackDraft,
  loadStackDraft,
  updateDraftComponent,
  updateDraftDependency,
  updateDraftEndpoint,
} from './stack-editor-model.js';

/**
 * @param {{
 *   root: HTMLElement,
 *   normalView: HTMLElement,
 *   api: Window['portreeveDesktop'],
 *   confirmDiscard(): Promise<boolean>,
 *   confirmDelete(impact: any): Promise<boolean>,
 *   confirmOverwrite(reason: string): Promise<boolean>,
 *   confirmInvalid(document: any): Promise<boolean>,
 *   onSnapshot(snapshot: any): void,
 *   onApplied(stackId: string|null, message: string, details: string[]): void,
 *   onOperation(message: string, details: string[]): void,
 * }} options
 */
export function createStackEditorView(options) {
  /** @type {any|null} */
  let documentState = null;
  /** @type {ReturnType<typeof createEmptyStackDraft>|null} */
  let draft = null;
  /** @type {string|null} */
  let selectedComponentId = null;
  let baseline = '';
  let lastValidPreview = /** @type {string|null} */ (null);
  const touched = new Set();
  let submitted = false;
  let busy = false;
  /** @type {any[]} */
  let trustedIssues = [];
  /** @type {{message: string, details: string[], kind: 'info'|'warning'|'error'}|null} */
  let localStatus = null;

  async function openSelected() {
    await open(() => options.api.openStackDocument());
  }

  /** @param {string} stackId */
  async function openKnown(stackId) {
    await open(() => options.api.openKnownStackDocument(stackId));
  }

  /** @param {() => Promise<any>} invoke */
  async function open(invoke) {
    if (busy) return;
    busy = true;
    try {
      const result = await invoke();
      if (result.outcome === 'cancelled') return;
      const nextDocument = result.document;
      if (
        nextDocument.fileState === 'invalid' &&
        !(await options.confirmInvalid(nextDocument))
      ) {
        return;
      }
      documentState = nextDocument;
      draft =
        nextDocument.definition === null
          ? createEmptyStackDraft(nextDocument.suggestedProject)
          : loadStackDraft(nextDocument.definition);
      selectedComponentId = draft.components[0]?.id ?? null;
      baseline = draftSignature(draft);
      touched.clear();
      submitted = false;
      trustedIssues = [];
      localStatus = documentNotice(nextDocument);
      const evaluation = evaluateStackDraft(draft);
      lastValidPreview = evaluation.preview;
      options.normalView.hidden = true;
      options.root.hidden = false;
      render();
      focusControl(draft.components.length === 0 ? 'add-component' : 'project');
    } catch (error) {
      options.onOperation('The stack editor could not be opened.', [
        errorMessage(error),
      ]);
    } finally {
      busy = false;
      if (isOpen()) setEditorBusy(false);
    }
  }

  function isOpen() {
    return documentState !== null && draft !== null;
  }

  function isDirty() {
    return draft !== null && draftSignature(draft) !== baseline;
  }

  async function requestClose() {
    if (!isOpen()) return true;
    if (isDirty() && !(await options.confirmDiscard())) return false;
    close();
    return true;
  }

  function close() {
    documentState = null;
    draft = null;
    selectedComponentId = null;
    baseline = '';
    lastValidPreview = null;
    touched.clear();
    submitted = false;
    trustedIssues = [];
    localStatus = null;
    options.root.replaceChildren();
    options.root.hidden = true;
    options.normalView.hidden = false;
  }

  function render() {
    if (draft === null || documentState === null) return;
    if (!draft.components.some(({ id }) => id === selectedComponentId)) {
      selectedComponentId = draft.components[0]?.id ?? null;
    }
    const evaluation = evaluateStackDraft(draft, {
      touched,
      submit: submitted,
      previousPreview: lastValidPreview,
    });
    if (evaluation.valid) lastValidPreview = evaluation.preview;
    const selected =
      draft.components.find(({ id }) => id === selectedComponentId) ?? null;

    const header = element('header', 'stack-editor-header');
    const headerCopy = element('div');
    const eyebrow = paragraph(`Stack root: ${documentState.stackRootName}`);
    eyebrow.className = 'eyebrow';
    const title = element('h2');
    title.textContent = documentState.stackId === null ? 'Create stack' : 'Edit stack';
    const subtitle = paragraph(
      'Define project topology here. Port allocation remains a separate Portreeve action.',
    );
    subtitle.className = 'muted';
    headerCopy.append(eyebrow, title, subtitle);
    header.append(
      actionButton('Back to stacks', async () => {
        await requestClose();
      }),
      headerCopy,
    );

    const status = renderLocalStatus();
    const validation = renderValidationSummary(evaluation);
    const project = field({
      label: 'Project',
      controlId: 'project',
      value: draft.project,
      issues: evaluation.visibleIssues,
      onInput: (value) =>
        mutate('project', () => {
          if (draft !== null) draft = { ...draft, project: value };
        }),
    });

    const componentNav = element('aside', 'editor-components panel');
    const componentHeading = element('div', 'editor-subheading');
    const componentTitle = element('h3');
    componentTitle.textContent = 'Components';
    componentHeading.append(
      componentTitle,
      actionButton(
        'Add component',
        () => {
          if (draft === null) return;
          const added = addDraftComponent(draft);
          draft = added.draft;
          selectedComponentId = added.id;
          renderAndFocus(`component:${added.id}:name`);
        },
        'primary small',
        'add-component',
      ),
    );
    const componentList = element('div', 'editor-component-list');
    componentList.replaceChildren(
      ...(draft.components.length === 0
        ? [emptyMessage('No components yet. Add one to describe this stack.')]
        : draft.components.map((component) => {
            const button = actionButton(component.name || 'Unnamed component', () => {
              selectedComponentId = component.id;
              render();
              focusControl(`component:${component.id}:name`);
            });
            button.classList.add('editor-component-button');
            button.classList.toggle('selected', component.id === selectedComponentId);
            const count = evaluation.issues.filter(({ controlId }) =>
              controlId.includes(`:${component.id}:`),
            ).length;
            if (count > 0)
              button.setAttribute(
                'aria-label',
                `${button.textContent}, ${count} validation issue${count === 1 ? '' : 's'}`,
              );
            return button;
          })),
    );
    componentNav.append(componentHeading, componentList);

    const detail = element('section', 'editor-detail panel');
    if (selected === null) {
      detail.append(
        emptyMessage(
          'Select or add a component to edit its endpoints and dependencies.',
        ),
      );
    } else {
      detail.append(renderComponent(selected, evaluation.visibleIssues));
    }

    const workspace = element('div', 'stack-editor-workspace');
    workspace.append(componentNav, detail);

    const preview = element('details', 'editor-preview panel');
    const previewSummary = element('summary');
    previewSummary.textContent = evaluation.previewCurrent
      ? 'Preview JSON — current'
      : evaluation.preview === null
        ? 'Preview JSON — awaiting a valid draft'
        : 'Preview JSON — last valid draft';
    const previewNote = paragraph(
      evaluation.previewCurrent
        ? 'These are the exact bytes Save and Apply will submit.'
        : evaluation.preview === null
          ? 'Complete the required fields to generate a preview.'
          : 'The current draft has errors. This preview shows the latest valid state.',
    );
    previewNote.className = evaluation.previewCurrent ? 'muted' : 'warning-text';
    const previewContent = element('pre', 'snapshot-content editor-json');
    previewContent.textContent = evaluation.preview ?? 'No valid preview yet.';
    preview.append(previewSummary, previewNote, previewContent);

    const footer = element('footer', 'stack-editor-actions');
    const dirtyLabel = paragraph(isDirty() ? 'Unsaved changes' : 'No unsaved changes');
    dirtyLabel.className = isDirty() ? 'warning-text' : 'muted';
    const controls = element('div', 'actions');
    controls.append(
      actionButton('Cancel', async () => {
        await requestClose();
      }),
      ...(documentState.lastSaved === true && !isDirty()
        ? [actionButton('Retry Apply', retryApply, 'primary')]
        : []),
      actionButton('Save and Apply', save, 'primary'),
    );
    footer.append(dirtyLabel, controls);

    options.root.replaceChildren(
      header,
      ...(status === null ? [] : [status]),
      ...(validation === null ? [] : [validation]),
      project,
      workspace,
      preview,
      footer,
    );
    setEditorBusy(busy);
  }

  /** @param {any} component @param {any[]} visibleIssues */
  function renderComponent(component, visibleIssues) {
    const fragment = document.createDocumentFragment();
    const heading = element('div', 'editor-detail-heading');
    const title = element('h3');
    title.textContent = component.name || 'Unnamed component';
    heading.append(
      title,
      actionButton(
        'Delete component',
        () => removeTarget({ kind: 'component', id: component.id }),
        'danger small',
      ),
    );
    fragment.append(heading);
    const identity = element('div', 'editor-field-grid');
    identity.append(
      field({
        label: 'Component name',
        controlId: `component:${component.id}:name`,
        value: component.name,
        issues: visibleIssues,
        onInput: (value) =>
          mutate(`component:${component.id}:name`, () => {
            if (draft !== null)
              draft = updateDraftComponent(draft, component.id, { name: value });
          }),
      }),
      field({
        label: 'Docker service (optional)',
        controlId: `component:${component.id}:docker-service`,
        value: component.dockerService,
        issues: visibleIssues,
        onInput: (value) =>
          mutate(`component:${component.id}:docker-service`, () => {
            if (draft !== null)
              draft = updateDraftComponent(draft, component.id, {
                dockerService: value,
              });
          }),
      }),
    );
    fragment.append(identity);

    const endpointHeading = subheading('Endpoints', 'Add endpoint', () => {
      if (draft === null) return;
      const added = addDraftEndpoint(draft, component.id);
      draft = added.draft;
      renderAndFocus(`endpoint:${added.id}:name`);
    });
    const endpoints = element('div', 'editor-record-list');
    endpoints.replaceChildren(
      ...(component.endpoints.length === 0
        ? [emptyMessage('No endpoints. Components may exist without exposing a port.')]
        : component.endpoints.map((/** @type {any} */ endpoint) =>
            renderEndpoint(component, endpoint, visibleIssues),
          )),
    );
    fragment.append(endpointHeading, endpoints);

    const dependencyHeading = subheading('Dependencies', 'Add dependency', () => {
      if (draft === null) return;
      const added = addDraftDependency(draft, component.id);
      draft = added.draft;
      renderAndFocus(`dependency:${added.id}:alias`);
    });
    const dependencies = element('div', 'editor-record-list');
    dependencies.replaceChildren(
      ...(component.dependencies.length === 0
        ? [
            emptyMessage(
              'No dependencies. Add one when this component consumes another endpoint.',
            ),
          ]
        : component.dependencies.map((/** @type {any} */ dependency) =>
            renderDependency(dependency, visibleIssues),
          )),
    );
    fragment.append(dependencyHeading, dependencies);
    return fragment;
  }

  /** @param {any} component @param {any} endpoint @param {any[]} visibleIssues */
  function renderEndpoint(component, endpoint, visibleIssues) {
    const article = element('article', 'editor-record');
    const heading = element('div', 'editor-record-heading');
    const title = element('h4');
    title.textContent = endpoint.name || 'Unnamed endpoint';
    heading.append(
      title,
      actionButton(
        'Delete endpoint',
        () => removeTarget({ kind: 'endpoint', id: endpoint.id }),
        'danger small',
      ),
    );
    const fields = element('div', 'editor-field-grid');
    fields.append(
      field({
        label: 'Endpoint name',
        controlId: `endpoint:${endpoint.id}:name`,
        value: endpoint.name,
        issues: visibleIssues,
        onInput: (value) =>
          mutate(`endpoint:${endpoint.id}:name`, () => {
            if (draft !== null)
              draft = updateDraftEndpoint(draft, endpoint.id, { name: value });
          }),
      }),
      checkboxField(
        'Publish for dependencies',
        `endpoint:${endpoint.id}:publish`,
        endpoint.publish,
        visibleIssues,
        (checked) =>
          mutate(`endpoint:${endpoint.id}:publish`, () => {
            if (draft !== null)
              draft = updateDraftEndpoint(draft, endpoint.id, { publish: checked });
          }),
      ),
      checkboxField(
        'Required during activation',
        `endpoint:${endpoint.id}:required`,
        endpoint.required,
        visibleIssues,
        (checked) =>
          mutate(`endpoint:${endpoint.id}:required`, () => {
            if (draft !== null)
              draft = updateDraftEndpoint(draft, endpoint.id, { required: checked });
          }),
      ),
    );
    const advanced = element('details', 'editor-advanced');
    const summary = element('summary');
    summary.textContent = 'Allocation and Docker';
    const advancedFields = element('div', 'editor-field-grid');
    advancedFields.append(
      selectField({
        label: 'Host-port policy',
        controlId: `endpoint:${endpoint.id}:allocation-mode`,
        value: endpoint.allocationMode,
        options: [
          ['automatic', 'Automatic'],
          ['preferred', 'Preferred port'],
          ['exact', 'Exact port'],
        ],
        issues: visibleIssues,
        onChange: (value) =>
          mutate(`endpoint:${endpoint.id}:allocation-mode`, () => {
            if (draft !== null)
              draft = updateDraftEndpoint(draft, endpoint.id, {
                allocationMode: value,
              });
          }),
      }),
      ...(endpoint.allocationMode === 'automatic'
        ? []
        : [
            field({
              label:
                endpoint.allocationMode === 'exact'
                  ? 'Exact host port'
                  : 'Preferred host port',
              controlId: `endpoint:${endpoint.id}:host-port`,
              value: endpoint.hostPort,
              type: 'number',
              min: '1',
              max: '65535',
              issues: visibleIssues,
              onInput: (value) =>
                mutate(`endpoint:${endpoint.id}:host-port`, () => {
                  if (draft !== null)
                    draft = updateDraftEndpoint(draft, endpoint.id, {
                      hostPort: value,
                    });
                }),
            }),
          ]),
      field({
        label: 'Docker container port (optional)',
        controlId: `endpoint:${endpoint.id}:container-port`,
        value: endpoint.containerPort,
        type: 'number',
        min: '1',
        max: '65535',
        issues: visibleIssues,
        onInput: (value) =>
          mutate(`endpoint:${endpoint.id}:container-port`, () => {
            if (draft !== null)
              draft = updateDraftEndpoint(draft, endpoint.id, { containerPort: value });
          }),
      }),
    );
    advanced.append(summary, advancedFields);
    article.append(heading, fields, advanced);
    return article;
  }

  /** @param {any} dependency @param {any[]} visibleIssues */
  function renderDependency(dependency, visibleIssues) {
    if (draft === null) throw new TypeError('Stack draft is unavailable.');
    const article = element('article', 'editor-record');
    const heading = element('div', 'editor-record-heading');
    const title = element('h4');
    title.textContent = dependency.alias || 'Unnamed dependency';
    heading.append(
      title,
      actionButton(
        'Delete dependency',
        () => {
          if (draft !== null) draft = deleteDraftDependency(draft, dependency.id);
          render();
        },
        'danger small',
      ),
    );
    const targetComponent = draft.components.find(
      ({ id }) => id === dependency.targetComponentId,
    );
    const fields = element('div', 'editor-field-grid');
    fields.append(
      field({
        label: 'Dependency alias',
        controlId: `dependency:${dependency.id}:alias`,
        value: dependency.alias,
        issues: visibleIssues,
        onInput: (value) =>
          mutate(`dependency:${dependency.id}:alias`, () => {
            if (draft !== null)
              draft = updateDraftDependency(draft, dependency.id, { alias: value });
          }),
      }),
      selectField({
        label: 'Target component',
        controlId: `dependency:${dependency.id}:target-component`,
        value: dependency.targetComponentId,
        options: [
          ['', 'Choose component'],
          ...draft.components.map((component) => [
            component.id,
            component.name || 'Unnamed component',
          ]),
        ],
        issues: visibleIssues,
        onChange: (value) =>
          mutate(`dependency:${dependency.id}:target-component`, () => {
            if (draft === null) return;
            draft = updateDraftDependency(draft, dependency.id, {
              targetComponentId: value,
              targetEndpointId: '',
            });
          }),
      }),
      selectField({
        label: 'Target endpoint',
        controlId: `dependency:${dependency.id}:target-endpoint`,
        value: dependency.targetEndpointId,
        options: [
          ['', 'Choose endpoint'],
          ...(targetComponent?.endpoints ?? []).map((endpoint) => [
            endpoint.id,
            `${endpoint.name || 'Unnamed endpoint'}${endpoint.publish ? '' : ' (not published)'}`,
          ]),
        ],
        issues: visibleIssues,
        onChange: (value) =>
          mutate(`dependency:${dependency.id}:target-endpoint`, () => {
            if (draft !== null)
              draft = updateDraftDependency(draft, dependency.id, {
                targetEndpointId: value,
              });
          }),
      }),
      checkboxField(
        'Required dependency',
        `dependency:${dependency.id}:required`,
        dependency.required,
        visibleIssues,
        (checked) =>
          mutate(`dependency:${dependency.id}:required`, () => {
            if (draft !== null)
              draft = updateDraftDependency(draft, dependency.id, {
                required: checked,
              });
          }),
      ),
    );
    article.append(heading, fields);
    return article;
  }

  /** @param {{kind: 'component'|'endpoint', id: string}} target */
  async function removeTarget(target) {
    if (draft === null) return;
    const attempted = deleteDraftTarget(draft, target);
    if (attempted.requiresConfirmation) {
      if (!(await options.confirmDelete(attempted.impact))) return;
      draft = deleteDraftTarget(draft, target, { cascade: true }).draft;
    } else {
      draft = attempted.draft;
    }
    render();
  }

  /** @param {string} controlId @param {() => void} update */
  function mutate(controlId, update) {
    touched.add(controlId);
    trustedIssues = [];
    localStatus = null;
    update();
    renderAndFocus(controlId);
  }

  async function save() {
    if (draft === null || documentState === null || busy) return;
    submitted = true;
    const evaluation = evaluateStackDraft(draft, {
      submit: true,
      previousPreview: lastValidPreview,
    });
    if (!evaluation.valid || evaluation.content === null) {
      render();
      focusControl(evaluation.firstInvalidControlId ?? 'validation-summary');
      return;
    }
    busy = true;
    render();
    try {
      let result = await options.api.saveStackDocument(
        documentState.documentId,
        evaluation.content,
      );
      options.onSnapshot(result.snapshot);
      if (result.outcome === 'conflict' && result.conflict?.token !== null) {
        if (!(await options.confirmOverwrite(result.conflict.reason))) return;
        result = await options.api.saveStackDocument(
          documentState.documentId,
          evaluation.content,
          result.conflict.token,
        );
        options.onSnapshot(result.snapshot);
      }
      handleMutationResult(result);
    } catch (error) {
      localStatus = {
        kind: 'error',
        message: 'Save and Apply failed.',
        details: [errorMessage(error)],
      };
      options.onOperation(localStatus.message, localStatus.details);
    } finally {
      busy = false;
      if (isOpen()) render();
    }
  }

  async function retryApply() {
    if (documentState === null || busy) return;
    busy = true;
    render();
    try {
      const result = await options.api.retryStackDocumentApply(
        documentState.documentId,
      );
      options.onSnapshot(result.snapshot);
      handleMutationResult(result);
    } catch (error) {
      localStatus = {
        kind: 'error',
        message: 'Retry Apply failed.',
        details: [errorMessage(error)],
      };
      options.onOperation(localStatus.message, localStatus.details);
    } finally {
      busy = false;
      if (isOpen()) render();
    }
  }

  /** @param {any} result */
  function handleMutationResult(result) {
    const details = [
      `Outcome: ${result.outcome}`,
      ...(result.error ? [`${result.error.code}: ${result.error.message}`] : []),
      ...result.issues.map((/** @type {any} */ issue) => issue.message),
    ];
    if (['saved-and-applied', 'applied'].includes(result.outcome)) {
      const stackId = result.stackId;
      const message = result.message;
      baseline = draft === null ? baseline : draftSignature(draft);
      close();
      options.onApplied(stackId, message, [
        ...details,
        'Port allocation remains explicit. Use Prepare allocation when ready.',
      ]);
      return;
    }
    if (result.outcome === 'saved-not-applied') {
      baseline = draft === null ? baseline : draftSignature(draft);
      documentState.lastSaved = true;
      localStatus = {
        kind: 'warning',
        message: result.message,
        details,
      };
    } else if (result.outcome === 'invalid') {
      trustedIssues = result.issues;
      localStatus = { kind: 'error', message: result.message, details };
    } else if (result.outcome === 'conflict') {
      localStatus = {
        kind: 'error',
        message: result.message,
        details: [
          ...details,
          'Reopen the definition to review the latest project file.',
        ],
      };
    } else {
      localStatus = { kind: 'error', message: result.message, details };
    }
    options.onOperation(result.message, details);
  }

  /** @param {any} evaluation */
  function renderValidationSummary(evaluation) {
    const issues = [
      ...evaluation.visibleIssues,
      ...trustedIssues.map((issue) => ({ ...issue, controlId: null })),
    ];
    if (issues.length === 0) return null;
    const summary = element('section', 'editor-validation');
    summary.id = 'validation-summary';
    summary.tabIndex = -1;
    summary.setAttribute('role', 'alert');
    const heading = element('h3');
    heading.textContent = submitted
      ? `Fix ${issues.length} issue${issues.length === 1 ? '' : 's'} before saving`
      : 'This draft needs attention';
    const list = element('ul');
    list.replaceChildren(
      ...issues.map((issue) => {
        const item = element('li');
        if (issue.controlId === null || issue.controlId === undefined) {
          item.textContent = issue.message;
        } else {
          const button = actionButton(issue.message, () =>
            focusControl(issue.controlId),
          );
          button.className = 'validation-link';
          item.append(button);
        }
        return item;
      }),
    );
    summary.append(heading, list);
    return summary;
  }

  function renderLocalStatus() {
    if (localStatus === null) return null;
    const section = element('section', `editor-status ${localStatus.kind}`);
    section.setAttribute('role', 'status');
    const heading = element('h3');
    heading.textContent = localStatus.message;
    const list = element('ul');
    list.replaceChildren(
      ...localStatus.details.map((detail) => {
        const item = element('li');
        item.textContent = detail;
        return item;
      }),
    );
    section.append(heading, list);
    return section;
  }

  /** @param {string} controlId */
  function renderAndFocus(controlId) {
    const active = document.activeElement;
    const selectionStart =
      active instanceof HTMLInputElement && active.id === controlId
        ? active.selectionStart
        : null;
    render();
    focusControl(controlId, selectionStart);
  }

  /** @param {string} controlId @param {number|null} [selectionStart] */
  function focusControl(controlId, selectionStart = null) {
    queueMicrotask(() => {
      const resolvedControlId =
        controlId === 'components' ? 'add-component' : controlId;
      const control = document.getElementById(resolvedControlId);
      if (!(control instanceof HTMLElement)) return;
      control.focus();
      if (
        selectionStart !== null &&
        control instanceof HTMLInputElement &&
        control.type === 'text'
      ) {
        control.setSelectionRange(selectionStart, selectionStart);
      }
    });
  }

  /** @param {boolean} disabled */
  function setEditorBusy(disabled) {
    for (const control of options.root.querySelectorAll('button, input, select')) {
      /** @type {HTMLButtonElement|HTMLInputElement|HTMLSelectElement} */ (
        control
      ).disabled = disabled;
    }
  }

  return Object.freeze({
    openSelected,
    openKnown,
    isOpen,
    isDirty,
    requestClose,
    close,
  });
}

/** @param {any} draft */
export function draftSignature(draft) {
  return JSON.stringify(draft);
}

/** @param {any} documentState */
export function documentNotice(documentState) {
  if (documentState.fileState === 'missing' && documentState.seedSource === 'applied') {
    return {
      kind: /** @type {const} */ ('warning'),
      message: 'The project definition file is missing.',
      details: [
        'This draft was recovered from the currently applied definition.',
        'Save and Apply will recreate portreeve.stack.json before contacting Portreeve.',
      ],
    };
  }
  if (documentState.fileState === 'missing') {
    return {
      kind: /** @type {const} */ ('info'),
      message: 'No project definition file exists yet.',
      details: ['Save and Apply will create portreeve.stack.json exclusively.'],
    };
  }
  if (documentState.fileState === 'invalid') {
    return {
      kind: /** @type {const} */ ('warning'),
      message: 'The existing project definition is invalid.',
      details: [
        ...documentState.issues.map((/** @type {any} */ issue) => issue.message),
        documentState.seedSource === 'applied'
          ? 'This replacement draft uses the currently applied definition.'
          : 'This is a new replacement draft.',
        'The existing file remains untouched until overwrite is confirmed during save.',
      ],
    };
  }
  return null;
}

/**
 * @param {{label: string, controlId: string, value: string, issues: any[], onInput(value: string): void, type?: string, min?: string, max?: string}} options
 */
function field(options) {
  const wrapper = element('div', 'editor-field');
  const label = document.createElement('label');
  label.htmlFor = options.controlId;
  label.textContent = options.label;
  const input = document.createElement('input');
  input.id = options.controlId;
  input.type = options.type ?? 'text';
  input.value = options.value;
  input.autocomplete = 'off';
  if (options.min !== undefined) input.min = options.min;
  if (options.max !== undefined) input.max = options.max;
  input.addEventListener('input', () => options.onInput(input.value));
  appendIssues(wrapper, options.controlId, options.issues);
  wrapper.prepend(label, input);
  return wrapper;
}

/** @param {string} labelText @param {string} controlId @param {boolean} checked @param {any[]} issues @param {(checked: boolean) => void} onChange */
function checkboxField(labelText, controlId, checked, issues, onChange) {
  const wrapper = element('div', 'editor-field checkbox-field');
  const label = document.createElement('label');
  label.htmlFor = controlId;
  const input = document.createElement('input');
  input.id = controlId;
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  label.append(input, document.createTextNode(labelText));
  wrapper.append(label);
  appendIssues(wrapper, controlId, issues);
  return wrapper;
}

/**
 * @param {{label: string, controlId: string, value: string, options: string[][], issues: any[], onChange(value: any): void}} options
 */
function selectField(options) {
  const wrapper = element('div', 'editor-field');
  const label = document.createElement('label');
  label.htmlFor = options.controlId;
  label.textContent = options.label;
  const select = document.createElement('select');
  select.id = options.controlId;
  for (const [value, text] of options.options) {
    const option = document.createElement('option');
    option.value = value ?? '';
    option.textContent = text ?? '';
    select.append(option);
  }
  select.value = options.value;
  select.addEventListener('change', () => options.onChange(select.value));
  wrapper.append(label, select);
  appendIssues(wrapper, options.controlId, options.issues);
  return wrapper;
}

/** @param {HTMLElement} wrapper @param {string} controlId @param {any[]} issues */
function appendIssues(wrapper, controlId, issues) {
  const matches = issues.filter((issue) => issue.controlId === controlId);
  if (matches.length === 0) return;
  const error = paragraph(matches.map(({ message }) => message).join(' '));
  error.className = 'field-error';
  error.id = `${controlId}:error`;
  wrapper.append(error);
  queueMicrotask(() => {
    document.getElementById(controlId)?.setAttribute('aria-describedby', error.id);
    document.getElementById(controlId)?.setAttribute('aria-invalid', 'true');
  });
}

/** @param {string} title @param {string} buttonLabel @param {() => void} invoke */
function subheading(title, buttonLabel, invoke) {
  const wrapper = element('div', 'editor-subheading');
  const heading = element('h3');
  heading.textContent = title;
  wrapper.append(heading, actionButton(buttonLabel, invoke, 'small'));
  return wrapper;
}

/** @param {string} label @param {() => void|Promise<void>} invoke @param {string} [className] @param {string} [id] */
function actionButton(label, invoke, className = '', id = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = className;
  button.id = id;
  button.addEventListener('click', invoke);
  return button;
}

/** @param {string} message */
function emptyMessage(message) {
  const value = paragraph(message);
  value.className = 'muted editor-empty';
  return value;
}

/** @param {string} tag @param {string} [className] */
function element(tag, className = '') {
  const value = document.createElement(tag);
  value.className = className;
  return value;
}

/** @param {string} text */
function paragraph(text) {
  const value = document.createElement('p');
  value.textContent = text;
  return value;
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error && error.message.trim() !== ''
    ? error.message
    : 'Refresh Portreeve evidence, then try again.';
}
