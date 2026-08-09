// @ts-check

import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import {
  LauncherOperationListSchema,
  StackListSchema,
  StackStatusSchema,
} from '../../../src/protocol/schemas.js';
import {
  launcherRevision,
  validateLauncherIntegrationTransition,
} from '../../../src/launcher/definition.js';
import {
  createLauncherDocument,
  inspectLauncherFile,
  readLauncherDocument,
  replaceLauncherDocument,
} from '../../../src/launcher/document.js';
import {
  createOutputTail,
  LAUNCHER_OUTPUT_LIMIT_BYTES,
} from '../../../src/launcher/command-session.js';
import {
  DesktopApplicationCloseStateSchema,
  DesktopLauncherDocumentMutationResultSchema,
  DesktopLauncherDocumentSchema,
  DesktopLauncherOutputEventSchema,
  DesktopLauncherOutputSchema,
  DesktopLauncherSaveOutputResultSchema,
  DesktopLauncherSessionEventSchema,
  DesktopLauncherSessionSchema,
  DesktopLauncherSnapshotSchema,
  DesktopLauncherTerminationResultSchema,
} from '../shared/schemas.js';

const MAX_RETAINED_OUTPUT_SESSIONS = 20;

/**
 * The Desktop launcher adapter is the only bridge between renderer capabilities and
 * the shared launcher runtime. Filesystem paths, commands-in-flight, credentials,
 * process identities, and environment authority never cross this boundary.
 *
 * @param {{
 *   client: any,
 *   runtime: any,
 *   saveOutput?: (input: {suggestedFilename: string, content: string}) => Promise<unknown>,
 *   now?: () => Date,
 *   sessionId?: () => string,
 *   documentId?: () => string,
 * }} options
 */
export function createLauncherAdapter(options) {
  const now = options.now ?? (() => new Date());
  const nextSessionId = options.sessionId ?? randomUUID;
  const nextDocumentId = options.documentId ?? randomUUID;
  /** @type {Map<string, any>} */
  const documents = new Map();
  /** @type {Map<string, any>} */
  const sessions = new Map();
  /** @type {Set<(event: unknown) => void>} */
  const outputSubscribers = new Set();
  /** @type {Set<(event: unknown) => void>} */
  const sessionSubscribers = new Set();
  /** @param {string} id */
  const requireSession = (id) => sessionFrom(sessions, id);

  async function list() {
    const observedAt = now().toISOString();
    try {
      const stacks = StackListSchema.parse(await options.client.listStacks());
      const results = await Promise.all(
        stacks.map(async (stack) => {
          try {
            return await summarizeStack(stack.id);
          } catch (error) {
            return {
              summary: {
                stackId: stack.id,
                project: stack.project,
                stackRootName: basename(stack.stackRoot),
                fileState: /** @type {const} */ ('invalid'),
                revision: null,
                trusted: false,
                integrationMode: null,
                startMode: null,
                attached: false,
                evidence: null,
                history: [],
                error: safeError(error),
              },
              stale: true,
            };
          }
        }),
      );
      return DesktopLauncherSnapshotSchema.parse({
        schemaVersion: 1,
        observedAt,
        stale: results.some(({ stale }) => stale),
        launchers: results.map(({ summary }) => summary),
        errors: [],
      });
    } catch (error) {
      return DesktopLauncherSnapshotSchema.parse({
        schemaVersion: 1,
        observedAt,
        stale: true,
        launchers: [],
        errors: [{ stackId: null, ...safeError(error) }],
      });
    }
  }

  /** @param {string} stackId */
  async function summarizeStack(stackId) {
    const status = StackStatusSchema.parse(
      await options.client.getStackStatus(stackId),
    );
    const loaded = await loadDocument(status.stack, options.runtime.stateStore);
    const [evidenceResult, historyResult] = await Promise.allSettled([
      options.runtime.evidenceService.inspectDaemon(status.stack, status),
      options.client.listLauncherOperations(stackId, { limit: 20 }),
    ]);
    const error =
      loaded.error ??
      (evidenceResult.status === 'rejected'
        ? safeError(evidenceResult.reason)
        : historyResult.status === 'rejected'
          ? safeError(historyResult.reason)
          : null);
    const attached = options.runtime.lifecycleService
      .listAttached()
      .some(
        (/** @type {{stackRoot: string}} */ entry) =>
          entry.stackRoot === status.stack.stackRoot,
      );
    return {
      summary: {
        stackId,
        project: status.stack.project,
        stackRootName: basename(status.stack.stackRoot),
        fileState: loaded.fileState,
        revision: loaded.revision,
        trusted: loaded.trusted,
        integrationMode: loaded.definition?.integration.mode ?? null,
        startMode: loaded.definition?.operations.start.mode ?? null,
        attached,
        evidence:
          evidenceResult.status === 'fulfilled' ? evidenceResult.value.summary : null,
        history:
          historyResult.status === 'fulfilled'
            ? LauncherOperationListSchema.parse(historyResult.value).map(reduceHistory)
            : [],
        error,
      },
      stale:
        evidenceResult.status === 'rejected' || historyResult.status === 'rejected',
    };
  }

  /** @param {string} stackId */
  async function openDocument(stackId) {
    const status = StackStatusSchema.parse(
      await options.client.getStackStatus(stackId),
    );
    const loaded = await loadDocument(status.stack, options.runtime.stateStore);
    const id = nextDocumentId();
    const handle = {
      id,
      stack: status.stack,
      baselineRevision: loaded.revision,
      baselineDefinition: loaded.definition,
      fileState: loaded.fileState,
    };
    documents.set(id, handle);
    return documentView(handle, loaded);
  }

  /** @param {{documentId: string, definition: unknown, overwrite: boolean, confirmDowngrade: boolean}} request */
  async function saveDocument(request) {
    const handle = documents.get(request.documentId);
    if (handle === undefined) {
      return documentFailure(
        request.documentId,
        'launcher_document_expired',
        'This launcher editor session is no longer available. Reopen it and try again.',
      );
    }
    try {
      if (handle.baselineDefinition !== null) {
        validateLauncherIntegrationTransition(
          handle.baselineDefinition,
          request.definition,
          { confirmDowngrade: request.confirmDowngrade },
        );
      }
      let saved;
      if (request.overwrite) {
        saved = await overwriteDocument(
          handle,
          request.definition,
          request.confirmDowngrade,
        );
      } else if (handle.fileState === 'missing') {
        saved = await createLauncherDocument(
          handle.stack.stackRoot,
          request.definition,
          {
            stackDefinition: handle.stack.definition,
          },
        );
      } else if (handle.fileState === 'valid' && handle.baselineRevision !== null) {
        saved = await replaceLauncherDocument(
          handle.stack.stackRoot,
          request.definition,
          handle.baselineRevision,
          { stackDefinition: handle.stack.definition },
        );
      } else {
        throw adapterError(
          'launcher_definition_changed',
          'The launcher file cannot be replaced without explicit overwrite confirmation.',
        );
      }
      await options.runtime.stateStore.trust(handle.stack.stackRoot, saved.revision);
      const loaded = await loadDocument(handle.stack, options.runtime.stateStore);
      handle.baselineRevision = loaded.revision;
      handle.baselineDefinition = loaded.definition;
      handle.fileState = loaded.fileState;
      return DesktopLauncherDocumentMutationResultSchema.parse({
        schemaVersion: 1,
        documentId: handle.id,
        outcome: 'saved-and-trusted',
        saved: true,
        trusted: true,
        message: 'Saved and trusted the exact launcher revision.',
        document: documentView(handle, loaded),
        error: null,
      });
    } catch (error) {
      if (
        errorCode(error) === 'launcher_definition_changed' ||
        errorCode(error) === 'launcher_definition_exists'
      ) {
        return DesktopLauncherDocumentMutationResultSchema.parse({
          schemaVersion: 1,
          documentId: handle.id,
          outcome: 'conflict',
          saved: false,
          trusted: false,
          message:
            'The launcher file changed outside PortReeve. Review it, explicitly overwrite it, or cancel.',
          document: null,
          error: safeError(error),
        });
      }
      const code = errorCode(error);
      return DesktopLauncherDocumentMutationResultSchema.parse({
        schemaVersion: 1,
        documentId: handle.id,
        outcome: code.startsWith('launcher_') ? 'invalid' : 'failed',
        saved: false,
        trusted: false,
        message: 'The launcher definition was not saved or trusted.',
        document: null,
        error: safeError(error),
      });
    }
  }

  /** @param {any} handle @param {unknown} definition @param {boolean} confirmDowngrade */
  async function overwriteDocument(handle, definition, confirmDowngrade) {
    const filename = join(handle.stack.stackRoot, 'portreeve.launcher.json');
    const current = await inspectLauncherFile(filename);
    if (current.kind === 'missing') {
      return createLauncherDocument(handle.stack.stackRoot, definition, {
        stackDefinition: handle.stack.definition,
      });
    }
    if (current.kind !== 'regular') {
      throw adapterError(
        'launcher_definition_not_regular',
        'The launcher file is not a regular file and cannot be overwritten.',
      );
    }
    try {
      const currentDocument = await readLauncherDocument(handle.stack.stackRoot, {
        stackDefinition: handle.stack.definition,
      });
      validateLauncherIntegrationTransition(currentDocument.definition, definition, {
        confirmDowngrade,
      });
    } catch (error) {
      if (errorCode(error) === 'launcher_integration_downgrade_confirmation_required') {
        throw error;
      }
      // Explicit overwrite may replace invalid bytes, but it never bypasses a
      // valid current document's downgrade warning.
    }
    return replaceLauncherDocument(
      handle.stack.stackRoot,
      definition,
      launcherRevision(current.content),
      { stackDefinition: handle.stack.definition },
    );
  }

  /** @param {{stackId: string, operation: 'start'|'stop'|'restart'|'status', runStartAnyway: boolean, allowDegraded: boolean}} request */
  async function begin(request) {
    const status = StackStatusSchema.parse(
      await options.client.getStackStatus(request.stackId),
    );
    const launcher = await readLauncherDocument(status.stack.stackRoot, {
      stackDefinition: status.stack.definition,
    });
    const sessionId = nextSessionId();
    const controller = new AbortController();
    const session = {
      id: sessionId,
      stack: status.stack,
      operation: request.operation,
      attachedLifecycle:
        (request.operation === 'start' || request.operation === 'restart') &&
        launcher.definition.operations.start?.mode === 'attached',
      state: 'running',
      startedAt: now().toISOString(),
      completedAt: null,
      result: null,
      controller,
      output: createOutputTail(LAUNCHER_OUTPUT_LIMIT_BYTES),
      nextSequence: 0,
    };
    sessions.set(sessionId, session);
    publishSession(session);
    void options.runtime.lifecycleService
      .execute({
        operation: request.operation,
        stack: status.stack,
        launcher,
        runStartAnyway: request.runStartAnyway,
        allowDegraded: request.allowDegraded,
        signal: controller.signal,
        onOutput: (
          /** @type {{stream: 'stdout'|'stderr'|'system', text: string}} */ chunk,
        ) => appendOutput(session, chunk),
      })
      .then(
        (/** @type {any} */ result) => settleSession(session, reduceResult(result)),
        (/** @type {unknown} */ error) =>
          settleSession(session, {
            outcome: 'failed',
            degraded: false,
            environmentSource: null,
            beforeEvidence: null,
            afterEvidence: null,
            steps: [],
            failure: { step: 'desktop', ...safeError(error) },
            integration: null,
          }),
      );
    trimSessions();
    return sessionView(session);
  }

  /** @param {string} sessionId */
  function inspectSession(sessionId) {
    const session = requireSession(sessionId);
    return sessionView(session);
  }

  /** @param {string} sessionId */
  function cancelSession(sessionId) {
    const session = requireSession(sessionId);
    if (session.state === 'running') session.controller.abort();
    return sessionView(session);
  }

  /** @param {string} stackId */
  async function terminateAttached(stackId) {
    const local = [...sessions.values()].find(
      (session) =>
        session.stack.id === stackId &&
        session.state === 'running' &&
        session.attachedLifecycle,
    );
    const stackRoot =
      local?.stack.stackRoot ??
      StackStatusSchema.parse(await options.client.getStackStatus(stackId)).stack
        .stackRoot;
    return DesktopLauncherTerminationResultSchema.parse({
      schemaVersion: 1,
      stackId,
      requested: options.runtime.lifecycleService.terminateAttached(stackRoot),
    });
  }

  /** @param {string} sessionId */
  function output(sessionId) {
    return outputView(requireSession(sessionId));
  }

  /** @param {string} sessionId */
  async function saveOutput(sessionId) {
    const session = requireSession(sessionId);
    if (options.saveOutput === undefined) {
      throw adapterError(
        'launcher_output_save_unavailable',
        'Saving launcher output is unavailable in this Desktop build.',
      );
    }
    const content = outputView(session)
      .chunks.map(({ text }) => text)
      .join('');
    return DesktopLauncherSaveOutputResultSchema.parse(
      await options.saveOutput({
        suggestedFilename: `${safeFilename(session.stack.project)}-${session.operation}.log`,
        content,
      }),
    );
  }

  function closeState() {
    const attached = [];
    const reportedRoots = new Set();
    for (const session of sessions.values()) {
      if (
        session.state !== 'running' ||
        !session.attachedLifecycle ||
        reportedRoots.has(session.stack.stackRoot)
      ) {
        continue;
      }
      reportedRoots.add(session.stack.stackRoot);
      attached.push({
        stackId: session.stack.id,
        project: session.stack.project,
        stackRootName: basename(session.stack.stackRoot),
        startedAt: session.startedAt,
      });
    }
    return DesktopApplicationCloseStateSchema.parse({
      schemaVersion: 1,
      allowed: attached.length === 0,
      attached,
    });
  }

  return Object.freeze({
    list,
    openDocument,
    saveDocument,
    begin,
    inspectSession,
    cancelSession,
    terminateAttached,
    output,
    saveOutput,
    closeState,
    /** @param {(event: unknown) => void} callback */
    subscribeOutput(callback) {
      outputSubscribers.add(callback);
      return () => outputSubscribers.delete(callback);
    },
    /** @param {(event: unknown) => void} callback */
    subscribeSessions(callback) {
      sessionSubscribers.add(callback);
      return () => sessionSubscribers.delete(callback);
    },
  });

  /** @param {any} session @param {{stream: 'stdout'|'stderr'|'system', text: string}} chunk */
  function appendOutput(session, chunk) {
    for (let offset = 0; offset < chunk.text.length; offset += 262_144) {
      const bounded = {
        sequence: session.nextSequence,
        stream: chunk.stream,
        text: chunk.text.slice(offset, offset + 262_144),
      };
      session.nextSequence += 1;
      session.output.append(bounded);
      const event = DesktopLauncherOutputEventSchema.parse({
        schemaVersion: 1,
        sessionId: session.id,
        stackId: session.stack.id,
        operation: session.operation,
        chunk: bounded,
      });
      for (const subscriber of outputSubscribers) subscriber(event);
    }
  }

  /** @param {any} session @param {any} result */
  function settleSession(session, result) {
    session.state = 'terminal';
    session.completedAt = now().toISOString();
    session.result = result;
    publishSession(session);
    trimSessions();
  }

  /** @param {any} session */
  function publishSession(session) {
    const event = DesktopLauncherSessionEventSchema.parse({
      schemaVersion: 1,
      sessionId: session.id,
      stackId: session.stack.id,
      operation: session.operation,
      state: session.state,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      result: session.result,
    });
    for (const subscriber of sessionSubscribers) subscriber(event);
  }

  function trimSessions() {
    while (sessions.size > MAX_RETAINED_OUTPUT_SESSIONS) {
      const terminal = [...sessions.entries()].find(
        ([, session]) => session.state === 'terminal',
      );
      if (terminal === undefined) return;
      sessions.delete(terminal[0]);
    }
  }
}

/** @param {any} stack @param {any} stateStore */
async function loadDocument(stack, stateStore) {
  const filename = join(stack.stackRoot, 'portreeve.launcher.json');
  const observed = await inspectLauncherFile(filename);
  if (observed.kind === 'missing') {
    return {
      fileState: /** @type {const} */ ('missing'),
      revision: null,
      trusted: false,
      canonical: false,
      definition: null,
      error: null,
    };
  }
  if (observed.kind !== 'regular') {
    return {
      fileState: /** @type {const} */ ('invalid'),
      revision: null,
      trusted: false,
      canonical: false,
      definition: null,
      error: {
        code: `launcher_definition_${observed.kind}`,
        message: 'The launcher definition is not a readable regular file.',
      },
    };
  }
  const revision = launcherRevision(observed.content);
  try {
    const launcher = await readLauncherDocument(stack.stackRoot, {
      stackDefinition: stack.definition,
    });
    return {
      fileState: /** @type {const} */ ('valid'),
      revision,
      trusted: await stateStore.isTrusted(stack.stackRoot, revision),
      canonical: launcher.sourceContent === launcher.canonicalContent,
      definition: launcher.definition,
      error: null,
    };
  } catch (error) {
    return {
      fileState: /** @type {const} */ ('invalid'),
      revision,
      trusted: false,
      canonical: false,
      definition: null,
      error: safeError(error),
    };
  }
}

/** @param {any} handle @param {any} loaded */
function documentView(handle, loaded) {
  return DesktopLauncherDocumentSchema.parse({
    schemaVersion: 1,
    documentId: handle.id,
    stackId: handle.stack.id,
    project: handle.stack.project,
    stackRootName: basename(handle.stack.stackRoot),
    fileState: loaded.fileState,
    revision: loaded.revision,
    trusted: loaded.trusted,
    canonical: loaded.canonical,
    definition: loaded.definition,
    error: loaded.error,
  });
}

/** @param {string} documentId @param {string} code @param {string} message */
function documentFailure(documentId, code, message) {
  return DesktopLauncherDocumentMutationResultSchema.parse({
    schemaVersion: 1,
    documentId,
    outcome: 'failed',
    saved: false,
    trusted: false,
    message: 'The launcher definition operation failed without completing.',
    document: null,
    error: { code, message },
  });
}

/** @param {any} operation */
function reduceHistory(operation) {
  return {
    id: operation.id,
    operation: operation.operation,
    executionMode: operation.executionMode,
    launcherRevision: operation.launcherRevision,
    generationId: operation.generationId,
    state: operation.state,
    outcome: operation.outcome,
    startedAt: operation.startedAt,
    completedAt: operation.completedAt,
    durationMilliseconds: operation.durationMilliseconds,
    exitCode: operation.exitCode,
    signal: operation.signal,
    degraded: operation.degraded,
    beforeEvidence: operation.beforeEvidence,
    afterEvidence: operation.afterEvidence,
    failure: operation.failure,
    integration: operation.integration,
  };
}

/** @param {any} result */
function reduceResult(result) {
  return {
    outcome: result.outcome,
    degraded: result.degraded,
    environmentSource: result.environmentSource,
    beforeEvidence: result.beforeEvidence,
    afterEvidence: result.afterEvidence,
    failure: result.failure,
    integration: result.integration,
    steps: result.steps.map((/** @type {any} */ { step, command }) => ({
      step,
      outcome: command.outcome,
      startedAt: command.startedAt,
      completedAt: command.completedAt,
      durationMilliseconds: command.durationMilliseconds,
      exitCode: command.exitCode,
      signal: command.signal,
      failure: command.failure,
    })),
  };
}

/** @param {any} session */
function sessionView(session) {
  return DesktopLauncherSessionSchema.parse({
    schemaVersion: 1,
    sessionId: session.id,
    stackId: session.stack.id,
    operation: session.operation,
    state: session.state,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    result: session.result,
    output: outputView(session),
  });
}

/** @param {any} session */
function outputView(session) {
  return DesktopLauncherOutputSchema.parse({
    schemaVersion: 1,
    sessionId: session.id,
    stackId: session.stack.id,
    operation: session.operation,
    ...session.output.result(),
  });
}

/** @param {string} value */
function safeFilename(value) {
  const safe = value.replaceAll(/[^A-Za-z0-9._-]+/g, '-').replaceAll(/^-|-$/g, '');
  return safe || 'portreeve-launcher';
}

/** @param {Map<string, any>} sessions @param {string} sessionId */
function sessionFrom(sessions, sessionId) {
  const session = sessions.get(sessionId);
  if (session === undefined) {
    throw adapterError(
      'launcher_session_missing',
      'This launcher session is no longer available.',
    );
  }
  return session;
}

/** @param {string} code @param {string} message */
function adapterError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}

/** @param {unknown} error */
function safeError(error) {
  const code = errorCode(error);
  const knownSafeMessage =
    code.startsWith('launcher_') || code === 'invalid_launcher_json';
  const message =
    knownSafeMessage && error instanceof Error && error.message.trim() !== ''
      ? error.message
      : 'The launcher operation failed without additional safe details.';
  return { code, message };
}

/** @param {unknown} error */
function errorCode(error) {
  if (error instanceof Error && error.name === 'ZodError') {
    return 'launcher_definition_invalid';
  }
  return error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.trim() !== ''
    ? error.code
    : 'unavailable';
}
