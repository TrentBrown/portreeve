// @ts-check

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { StackRecordSchema, StackStatusSchema } from '../protocol/schemas.js';
import {
  AttachedCommandRegistry,
  LAUNCHER_OUTPUT_LIMIT_BYTES,
  LauncherCommandResultSchema,
  resolveLauncherShell,
  runFiniteCommand,
  utf8Suffix,
} from './command-session.js';
import { LauncherExecutionDocumentSchema } from './environment-service.js';

const OperationSchema = z.enum(['start', 'stop', 'restart', 'status']);
const LauncherLifecycleDocumentSchema = LauncherExecutionDocumentSchema.extend({
  workingDirectory: z.string().min(1),
}).strict();

export const LauncherLifecycleStepSchema = z
  .object({
    step: z.enum(['start', 'stop', 'restart', 'status']),
    command: LauncherCommandResultSchema,
  })
  .strict();

export class LauncherLifecycleService {
  /**
   * @param {{
   *   client: Pick<import('../../packages/client/src/client.js').PortreeveClient, 'socketPath' | 'getStackStatus' | 'prepareStack' | 'beginLauncherOperation' | 'renewLauncherOperation' | 'completeLauncherOperation'>,
   *   stateStore: Pick<ReturnType<typeof import('./local-state.js').createLauncherLocalStateStore>, 'isTrusted' | 'cached'>,
   *   environmentService: Pick<import('./environment-service.js').LauncherEnvironmentService, 'resolve'>,
   *   evidenceService: Pick<import('./evidence-service.js').LauncherEvidenceService, 'inspectDaemon' | 'inspectLocal'>,
   *   runCommand?: typeof runFiniteCommand,
   *   attachedCommands?: AttachedCommandRegistry,
   *   resolveShell?: typeof resolveLauncherShell,
   *   now?: () => Date,
   *   operationId?: () => string,
   *   attachedEvidencePollMilliseconds?: number,
   * }} options
   */
  constructor({
    client,
    stateStore,
    environmentService,
    evidenceService,
    runCommand = runFiniteCommand,
    attachedCommands = new AttachedCommandRegistry(),
    resolveShell = resolveLauncherShell,
    now = () => new Date(),
    operationId = randomUUID,
    attachedEvidencePollMilliseconds = 1_000,
  }) {
    this.client = client;
    this.stateStore = stateStore;
    this.environmentService = environmentService;
    this.evidenceService = evidenceService;
    this.runCommand = runCommand;
    this.attachedCommands = attachedCommands;
    this.resolveShell = resolveShell;
    this.now = now;
    this.operationId = operationId;
    this.attachedEvidencePollMilliseconds = attachedEvidencePollMilliseconds;
  }

  /** Terminate only the exact attached process group created by this runtime. */
  /** @param {string} stackRoot */
  terminateAttached(stackRoot) {
    return this.attachedCommands.terminate(stackRoot);
  }

  /** Application-close hooks can use this reduced view without gaining process access. */
  listAttached() {
    return this.attachedCommands.list();
  }

  /**
   * @param {{
   *   operation: 'start' | 'stop' | 'restart' | 'status',
   *   stack: unknown,
   *   launcher: unknown,
   *   runStartAnyway?: boolean,
   *   allowDegraded?: boolean,
   *   signal?: AbortSignal,
   *   onOutput?: (event: {step: 'start' | 'stop' | 'restart' | 'status', sequence: number, stream: 'stdout' | 'stderr' | 'system', text: string}) => void,
   * }} input
   * @returns {Promise<any>}
   */
  async execute(input) {
    const operation = OperationSchema.parse(input.operation);
    const stack = StackRecordSchema.parse(input.stack);
    const launcher = immutableLauncher(input.launcher);
    if (launcher.stackRoot !== stack.stackRoot) {
      return failedResult(
        operation,
        'validate',
        'launcher_stack_mismatch',
        'The launcher root does not match the applied stack root.',
      );
    }
    if (!(await this.stateStore.isTrusted(stack.stackRoot, launcher.revision))) {
      return failedResult(
        operation,
        'trust',
        'launcher_untrusted',
        'The current launcher revision has not been trusted.',
      );
    }
    if (
      operation === 'restart' &&
      launcher.definition.operations.start.mode === 'attached'
    ) {
      return this.#executeAttachedRestart({ ...input, operation, stack, launcher });
    }

    let daemon;
    try {
      daemon = await this.#daemonState(stack);
    } catch (error) {
      if (!isUnavailable(error)) {
        return failedResult(
          operation,
          'evidence-before',
          errorCode(error),
          errorMessage(error),
        );
      }
      return this.#executeDegraded({ ...input, operation, stack, launcher });
    }

    const initialFailure = admissionFailure(operation, daemon.evidence.summary, {
      runStartAnyway: input.runStartAnyway ?? false,
      composedStart: false,
    });
    if (initialFailure !== null) {
      return failedResult(
        operation,
        'admission',
        initialFailure.code,
        initialFailure.message,
        { beforeEvidence: daemon.evidence.summary },
      );
    }
    if (operation === 'status' && launcher.definition.operations.status === undefined) {
      const generationId = currentGeneration(stack, daemon.status)?.id ?? null;
      return {
        operation,
        outcome: /** @type {const} */ ('succeeded'),
        degraded: false,
        environmentSource: null,
        beforeEvidence: daemon.evidence.summary,
        afterEvidence: daemon.evidence.summary,
        steps: [],
        failure: null,
        integration: assessIntegration({
          mode: launcher.definition.integration.mode,
          operation,
          generationId,
          commandSucceeded: true,
          afterEvidence: daemon.evidence.summary,
          matchingActivationEvidence: null,
        }).summary,
        daemonOperation: null,
      };
    }

    let environment;
    try {
      environment = await this.#environmentFor({
        operation:
          operation === 'restart' &&
          launcher.definition.operations.restart === undefined
            ? 'stop'
            : operation,
        stack,
        launcher,
        daemon,
      });
    } catch (error) {
      return failedResult(
        operation,
        'environment',
        errorCode(error),
        errorMessage(error),
        {
          beforeEvidence: daemon.evidence.summary,
        },
      );
    }

    let session;
    try {
      session = await this.client.beginLauncherOperation(stack.id, {
        operation,
        executionMode:
          operation === 'start' &&
          launcher.definition.operations.start.mode === 'attached'
            ? 'attached'
            : 'finite',
        launcherRevision: launcher.revision,
        callerOperationId: this.operationId(),
        generationId: environment.generationId,
      });
    } catch (error) {
      return failedResult(
        operation,
        'coordination-begin',
        errorCode(error),
        errorMessage(error),
        {
          beforeEvidence: daemon.evidence.summary,
        },
      );
    }

    return this.#withSession({
      input,
      operation,
      stack,
      launcher,
      environment,
      session,
    });
  }

  /**
   * Attached Restart is deliberately two coordinated operations: finite Stop, then attached Start.
   * @param {any} input
   * @returns {Promise<any>}
   */
  async #executeAttachedRestart(input) {
    let before;
    try {
      before = (await this.#daemonState(input.stack)).evidence.summary;
    } catch (error) {
      if (isUnavailable(error)) {
        return failedResult(
          'restart',
          'daemon',
          'launcher_daemon_required',
          'Start and Restart require the PortReeve service.',
        );
      }
      return failedResult(
        'restart',
        'evidence-before',
        errorCode(error),
        errorMessage(error),
      );
    }
    const guard = admissionFailure('restart', before, {
      runStartAnyway: false,
      composedStart: false,
    });
    if (guard !== null) {
      return failedResult('restart', 'admission', guard.code, guard.message, {
        beforeEvidence: before,
      });
    }
    const stopped = await this.execute({
      ...input,
      operation: 'stop',
      launcher: input.launcher,
    });
    if (stopped.outcome !== 'succeeded') {
      return { ...stopped, operation: /** @type {const} */ ('restart') };
    }
    const started = await this.execute({
      ...input,
      operation: 'start',
      launcher: input.launcher,
      runStartAnyway: false,
    });
    return {
      ...started,
      operation: /** @type {const} */ ('restart'),
      beforeEvidence: before,
      steps: [...stopped.steps, ...started.steps],
    };
  }

  /** @param {{operation: 'start' | 'stop' | 'restart' | 'status', stack: any, launcher: any, runStartAnyway?: boolean, allowDegraded?: boolean, signal?: AbortSignal, onOutput?: Function}} input */
  async #executeDegraded(input) {
    if (input.operation === 'start' || input.operation === 'restart') {
      return failedResult(
        input.operation,
        'daemon',
        'launcher_daemon_required',
        'Start and Restart require the PortReeve service.',
      );
    }
    if (input.operation === 'stop' && input.allowDegraded !== true) {
      return failedResult(
        input.operation,
        'admission',
        'launcher_degraded_confirmation_required',
        'Stopping without daemon coordination requires explicit confirmation.',
      );
    }
    let cache;
    try {
      cache = await this.stateStore.cached(
        input.stack.stackRoot,
        input.launcher.revision,
      );
    } catch (error) {
      return failedResult(
        input.operation,
        'environment',
        errorCode(error),
        errorMessage(error),
      );
    }
    if (cache === null) {
      return failedResult(
        input.operation,
        'environment',
        'launcher_cached_environment_missing',
        'No cached endpoint environment is available for this launcher revision.',
      );
    }
    let before;
    try {
      before = await this.evidenceService.inspectLocal(cache);
    } catch (error) {
      return failedResult(
        input.operation,
        'evidence-before',
        errorCode(error),
        errorMessage(error),
      );
    }
    const configured = input.launcher.definition.operations[input.operation];
    if (configured === undefined) {
      return {
        operation: input.operation,
        outcome: /** @type {const} */ ('succeeded'),
        degraded: true,
        environmentSource: /** @type {const} */ ('cached'),
        beforeEvidence: before.summary,
        afterEvidence: before.summary,
        steps: [],
        failure: null,
        daemonOperation: null,
      };
    }
    let command;
    try {
      command = await this.#runStep({
        step: input.operation,
        configured,
        launcher: input.launcher,
        environment: cache.environment,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
        ...(input.onOutput === undefined ? {} : { onOutput: input.onOutput }),
      });
    } catch (error) {
      return failedResult(
        input.operation,
        'execution',
        errorCode(error),
        errorMessage(error),
        { beforeEvidence: before.summary },
      );
    }
    const after = await this.evidenceService.inspectLocal(cache).catch(() => null);
    return lifecycleResult({
      operation: input.operation,
      degraded: true,
      environmentSource: 'cached',
      beforeEvidence: before.summary,
      afterEvidence: after?.summary ?? null,
      steps: [{ step: input.operation, command }],
      daemonOperation: null,
    });
  }

  /** @param {{input: any, operation: 'start' | 'stop' | 'restart' | 'status', stack: any, launcher: any, environment: any, session: any}} context */
  async #withSession(context) {
    const controller = new AbortController();
    const externalAbort = () => controller.abort();
    context.input.signal?.addEventListener('abort', externalAbort, { once: true });
    let renewalFailure = /** @type {{code: string, message: string} | null} */ (null);
    let renewalTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);
    let renewalInFlight = Promise.resolve();
    let renewalStopped = false;
    const renew = async () => {
      if (renewalStopped) return;
      try {
        const response = await this.client.renewLauncherOperation(
          context.session.operation.id,
          context.session.credential,
        );
        scheduleRenewal(response.renewAfterMilliseconds);
      } catch (error) {
        renewalFailure = { code: errorCode(error), message: errorMessage(error) };
        controller.abort();
      }
    };
    const scheduleRenewal = (/** @type {number} */ milliseconds) => {
      if (renewalStopped) return;
      renewalTimer = setTimeout(() => {
        renewalInFlight = renew();
      }, milliseconds);
      renewalTimer.unref?.();
    };
    scheduleRenewal(context.session.renewAfterMilliseconds);

    let beforeEvidence = null;
    let afterEvidence = null;
    let matchingActivationEvidence = /** @type {any} */ (null);
    /** @type {Array<{step: 'start' | 'stop' | 'restart' | 'status', command: z.infer<typeof LauncherCommandResultSchema>}>} */
    let steps = [];
    let failure = /** @type {{step: string, code: string, message: string} | null} */ (
      null
    );
    try {
      const fresh = await this.#daemonState(context.stack);
      beforeEvidence = fresh.evidence.summary;
      const currentGenerationId =
        currentGeneration(context.stack, fresh.status)?.id ?? null;
      const guard =
        currentGenerationId !== context.environment.generationId
          ? {
              code: 'launcher_generation_changed',
              message:
                'The allocation generation changed before command execution; retry with fresh context.',
            }
          : admissionFailure(context.operation, beforeEvidence, {
              runStartAnyway: context.input.runStartAnyway ?? false,
              composedStart: false,
            });
      if (guard !== null) {
        failure = { step: 'admission', ...guard };
      } else if (
        context.operation === 'restart' &&
        context.launcher.definition.operations.restart === undefined
      ) {
        const composed = await this.#runComposedRestart({
          ...context,
          daemon: fresh,
          signal: controller.signal,
        });
        steps = composed.steps;
        afterEvidence = composed.afterEvidence;
        failure = composed.failure;
      } else {
        const configured = context.launcher.definition.operations[context.operation];
        if (configured === undefined) {
          throw lifecycleError(
            'launcher_operation_missing',
            'The launcher operation is not configured.',
          );
        }
        const execution =
          context.operation === 'start' && configured.mode === 'attached'
            ? await this.#runAttachedStep({
                step: context.operation,
                configured,
                launcher: context.launcher,
                environment: context.environment.environment,
                stack: context.stack,
                generationId: context.environment.generationId,
                signal: controller.signal,
                onOutput: context.input.onOutput,
              })
            : {
                command: await this.#runStep({
                  step: context.operation,
                  configured,
                  launcher: context.launcher,
                  environment: context.environment.environment,
                  signal: controller.signal,
                  onOutput: context.input.onOutput,
                }),
                matchingActivationEvidence: null,
              };
        const command = execution.command;
        matchingActivationEvidence = execution.matchingActivationEvidence;
        steps = [{ step: context.operation, command }];
        afterEvidence = (await this.#daemonState(context.stack)).evidence.summary;
      }
    } catch (error) {
      failure = {
        step: 'execution',
        code: errorCode(error),
        message: errorMessage(error),
      };
      try {
        afterEvidence = (await this.#daemonState(context.stack)).evidence.summary;
      } catch {
        // The structured execution failure remains primary; unavailable evidence is null.
      }
    } finally {
      renewalStopped = true;
      if (renewalTimer !== null) clearTimeout(renewalTimer);
      await renewalInFlight;
      context.input.signal?.removeEventListener('abort', externalAbort);
    }
    if (renewalFailure !== null) {
      failure = {
        step: 'coordination-renew',
        code: renewalFailure.code,
        message: renewalFailure.message,
      };
    }
    const integration = assessIntegration({
      mode: context.launcher.definition.integration.mode,
      operation: context.operation,
      generationId: context.environment.generationId,
      commandSucceeded: steps.every(({ command }) => command.outcome === 'succeeded'),
      afterEvidence,
      matchingActivationEvidence,
    });
    if (failure === null && integration.failure !== null) {
      failure = integration.failure;
    }
    const provisional = lifecycleResult({
      operation: context.operation,
      degraded: false,
      environmentSource: context.environment.source,
      beforeEvidence,
      afterEvidence,
      steps,
      failure,
      integration: integration.summary,
      daemonOperation: context.session.operation,
    });
    const completion = completionFromResult(provisional);
    try {
      const completed = await this.client.completeLauncherOperation(
        context.session.operation.id,
        context.session.credential,
        completion,
      );
      return { ...provisional, daemonOperation: completed.operation };
    } catch (error) {
      return {
        ...provisional,
        outcome: /** @type {const} */ ('failed'),
        failure: {
          step: 'coordination-complete',
          code: errorCode(error),
          message: errorMessage(error),
        },
      };
    }
  }

  /** @param {{step: 'start', configured: any, launcher: any, environment: Record<string, string>, stack: any, generationId: string | null, signal: AbortSignal, onOutput?: Function}} context */
  async #runAttachedStep(context) {
    let settled = false;
    let matchingActivationEvidence = /** @type {any} */ (null);
    const commandPromise = this.#runStep(context).finally(() => {
      settled = true;
    });
    const commandSettled = commandPromise.then(
      () => undefined,
      () => undefined,
    );
    const monitorPromise = (async () => {
      while (!settled && !context.signal.aborted) {
        await Promise.race([
          delay(this.attachedEvidencePollMilliseconds),
          commandSettled,
        ]);
        if (settled || context.signal.aborted) break;
        try {
          const evidence = (await this.#daemonState(context.stack)).evidence.summary;
          if (isMatchingVerifiedEvidence(evidence, context.generationId)) {
            matchingActivationEvidence = evidence;
            break;
          }
        } catch {
          // Renewal and final evidence collection own service-loss reporting.
        }
      }
    })();
    const command = await commandPromise;
    await monitorPromise;
    return { command, matchingActivationEvidence };
  }

  /** @param {{operation: string, stack: any, launcher: any, daemon: any}} context */
  async #environmentFor(context) {
    const generation = currentGeneration(context.stack, context.daemon.status);
    if (context.operation === 'start') {
      const resolved = await this.environmentService.resolve({
        stack: context.stack,
        launcher: context.launcher,
        ...(generation === null ? {} : { generation }),
        ...(activeActivation(context.daemon.status.activation) === null
          ? {}
          : { activation: activeActivation(context.daemon.status.activation) }),
      });
      return {
        source: 'daemon',
        environment: resolved.environment,
        generationId: resolved.generationId,
      };
    }
    if (context.operation === 'restart' && generation === null) {
      const resolved = await this.environmentService.resolve({
        stack: context.stack,
        launcher: context.launcher,
      });
      return {
        source: 'daemon',
        environment: resolved.environment,
        generationId: resolved.generationId,
      };
    }
    if (generation !== null) {
      const resolved = await this.environmentService.resolve({
        stack: context.stack,
        launcher: context.launcher,
        generation,
        ...(activeActivation(context.daemon.status.activation) === null
          ? {}
          : { activation: activeActivation(context.daemon.status.activation) }),
      });
      return {
        source: 'daemon',
        environment: resolved.environment,
        generationId: resolved.generationId,
      };
    }
    return {
      source: /** @type {const} */ ('daemon-minimal'),
      generationId: null,
      environment: {
        PORTREEVE_STACK_ROOT: context.stack.stackRoot,
        PORTREEVE_STACK_ID: context.stack.id,
        PORTREEVE_SOCKET: this.client.socketPath,
      },
    };
  }

  /** @param {{stack: any, launcher: any, daemon: any, environment: any, input: any, signal: AbortSignal}} context */
  async #runComposedRestart(context) {
    const stop = await this.#runStep({
      step: 'stop',
      configured: context.launcher.definition.operations.stop,
      launcher: context.launcher,
      environment: context.environment.environment,
      signal: context.signal,
      onOutput: context.input.onOutput,
    });
    /** @type {Array<{step: 'start' | 'stop' | 'restart' | 'status', command: z.infer<typeof LauncherCommandResultSchema>}>} */
    const steps = [{ step: 'stop', command: stop }];
    if (stop.outcome !== 'succeeded') {
      const after = await this.#daemonState(context.stack);
      return { steps, afterEvidence: after.evidence.summary, failure: null };
    }
    const afterStop = await this.#daemonState(context.stack);
    const guard = admissionFailure('start', afterStop.evidence.summary, {
      runStartAnyway: false,
      composedStart: true,
    });
    if (guard !== null) {
      return {
        steps,
        afterEvidence: afterStop.evidence.summary,
        failure: { step: 'restart-revalidation', ...guard },
      };
    }
    const startEnvironment = await this.#environmentFor({
      operation: 'start',
      stack: context.stack,
      launcher: context.launcher,
      daemon: afterStop,
    });
    const beforeStart = await this.#daemonState(context.stack);
    const secondGuard = admissionFailure('start', beforeStart.evidence.summary, {
      runStartAnyway: false,
      composedStart: true,
    });
    if (secondGuard !== null) {
      return {
        steps,
        afterEvidence: beforeStart.evidence.summary,
        failure: { step: 'restart-revalidation', ...secondGuard },
      };
    }
    const start = await this.#runStep({
      step: 'start',
      configured: context.launcher.definition.operations.start,
      launcher: context.launcher,
      environment: startEnvironment.environment,
      signal: context.signal,
      onOutput: context.input.onOutput,
    });
    steps.push({ step: 'start', command: start });
    const afterStart = await this.#daemonState(context.stack);
    return { steps, afterEvidence: afterStart.evidence.summary, failure: null };
  }

  /** @param {{step: 'start' | 'stop' | 'restart' | 'status', configured: {command: string, mode?: 'finite' | 'attached', timeoutSeconds?: number}, launcher: any, environment: Record<string, string>, signal?: AbortSignal, onOutput?: Function}} context */
  async #runStep(context) {
    if (context.step === 'start' && context.configured.mode === 'attached') {
      return this.attachedCommands.run(context.launcher.stackRoot, {
        command: context.configured.command,
        shellPath: this.resolveShell(context.launcher.definition.shell),
        workingDirectory: context.launcher.workingDirectory,
        environment: context.environment,
        ...(context.signal === undefined ? {} : { signal: context.signal }),
        ...(context.onOutput === undefined
          ? {}
          : {
              onOutput: (chunk) => context.onOutput?.({ step: context.step, ...chunk }),
            }),
        now: this.now,
      });
    }
    if (context.configured.timeoutSeconds === undefined) {
      throw lifecycleError(
        'launcher_timeout_missing',
        'Finite commands require a timeout.',
      );
    }
    return this.runCommand({
      command: context.configured.command,
      shellPath: this.resolveShell(context.launcher.definition.shell),
      workingDirectory: context.launcher.workingDirectory,
      environment: context.environment,
      timeoutMilliseconds: context.configured.timeoutSeconds * 1_000,
      ...(context.signal === undefined ? {} : { signal: context.signal }),
      ...(context.onOutput === undefined
        ? {}
        : {
            onOutput: (chunk) => context.onOutput?.({ step: context.step, ...chunk }),
          }),
      now: this.now,
    });
  }

  /** @param {any} stack */
  async #daemonState(stack) {
    const status = StackStatusSchema.parse(await this.client.getStackStatus(stack.id));
    const evidence = await this.evidenceService.inspectDaemon(stack, status);
    return { status, evidence };
  }
}

/** @param {unknown} input */
function immutableLauncher(input) {
  const source =
    input !== null && typeof input === 'object'
      ? /** @type {Record<string, unknown>} */ (input)
      : {};
  const parsed = LauncherLifecycleDocumentSchema.parse({
    stackRoot: source.stackRoot,
    revision: source.revision,
    workingDirectory: source.workingDirectory,
    definition: source.definition,
  });
  return deepFreeze(structuredClone(parsed));
}

/** @param {any} value */
function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** @param {any} stack @param {any} status */
function currentGeneration(stack, status) {
  const generation = status.generation;
  return generation !== null &&
    generation.stackId === stack.id &&
    generation.revision === stack.currentRevision &&
    generation.state === 'valid'
    ? generation
    : null;
}

/** @param {any} activation */
function activeActivation(activation) {
  return activation !== null &&
    ['starting', 'confirmed', 'degraded'].includes(activation.state)
    ? activation
    : null;
}

/** @param {'start' | 'stop' | 'restart' | 'status'} operation @param {any} evidence @param {{runStartAnyway: boolean, composedStart: boolean}} options */
function admissionFailure(operation, evidence, options) {
  if (operation === 'stop' || operation === 'status') return null;
  if (operation === 'restart') {
    if (evidence.classification === 'conflicting') {
      return {
        code: 'launcher_evidence_conflicting',
        message: 'Conflicting ownership evidence blocks Restart.',
      };
    }
    if (evidence.classification === 'uncertain') {
      return {
        code: 'launcher_evidence_uncertain',
        message: 'Uncertain listener evidence blocks Restart.',
      };
    }
    return null;
  }
  const messages = {
    verified: 'A verified activation is already running.',
    'fully-observed': options.composedStart
      ? 'Listeners remain fully observed after Stop; composed Restart will not run Start.'
      : 'The command-only stack is already fully observed; use Status or Restart.',
    conflicting: 'Conflicting ownership evidence blocks Start.',
    uncertain: 'Uncertain listener evidence blocks Start.',
  };
  if (evidence.classification === 'partial' && !options.runStartAnyway) {
    return {
      code: 'launcher_start_anyway_required',
      message: 'Partial non-conflicting evidence requires explicit Run Start Anyway.',
    };
  }
  const message =
    messages[/** @type {keyof typeof messages} */ (evidence.classification)];
  return message === undefined
    ? null
    : {
        code: `launcher_evidence_${evidence.classification.replaceAll('-', '_')}`,
        message,
      };
}

/** @param {{operation: string, degraded: boolean, environmentSource: string | null, beforeEvidence: any, afterEvidence: any, steps: any[], failure?: any, integration?: any, daemonOperation: any}} value */
function lifecycleResult(value) {
  const steps = boundStepOutputs(value.steps, LAUNCHER_OUTPUT_LIMIT_BYTES);
  const failedCommand = steps.find(({ command }) => command.outcome !== 'succeeded');
  const failure =
    value.failure ??
    (failedCommand === undefined
      ? null
      : {
          step: failedCommand.step,
          code: failedCommand.command.failure?.code ?? 'launcher_command_failed',
          message:
            failedCommand.command.failure?.message ?? 'The launcher command failed.',
        });
  const commandOutcome = failedCommand?.command.outcome;
  return {
    operation: value.operation,
    outcome:
      value.failure !== null && value.failure !== undefined
        ? /** @type {const} */ ('failed')
        : failure !== null
          ? commandOutcome === 'cancelled' || commandOutcome === 'timed-out'
            ? commandOutcome
            : /** @type {const} */ ('failed')
          : /** @type {const} */ ('succeeded'),
    degraded: value.degraded,
    environmentSource: value.environmentSource,
    beforeEvidence: value.beforeEvidence,
    afterEvidence: value.afterEvidence,
    steps,
    failure,
    integration: value.integration ?? null,
    daemonOperation: value.daemonOperation,
  };
}

/** @param {{mode: 'command-only' | 'verified-activation', operation: 'start' | 'stop' | 'restart' | 'status', generationId: string | null, commandSucceeded: boolean, afterEvidence: any, matchingActivationEvidence: any}} input */
function assessIntegration(input) {
  const matchingEvidence = isMatchingVerifiedEvidence(
    input.matchingActivationEvidence ?? input.afterEvidence,
    input.generationId,
  );
  const summary = {
    mode: input.mode,
    verified: matchingEvidence,
    upgradeSuggested: input.mode === 'command-only' && matchingEvidence,
    generationId: input.generationId,
    activationId: matchingEvidence
      ? (input.matchingActivationEvidence ?? input.afterEvidence).activationId
      : null,
  };
  if (input.mode !== 'verified-activation' || !input.commandSucceeded) {
    return { summary, failure: null };
  }
  if (input.operation === 'start' && !matchingEvidence) {
    return {
      summary,
      failure: {
        step: 'activation-verification',
        code: 'launcher_activation_not_verified',
        message:
          'The Start command exited successfully without a matching verified activation for the supplied generation.',
      },
    };
  }
  if (input.operation === 'stop' && input.afterEvidence?.classification !== 'stopped') {
    return {
      summary,
      failure: {
        step: 'activation-verification',
        code: 'launcher_activation_not_ended',
        message:
          'The Stop command exited successfully without ending the active stack evidence.',
      },
    };
  }
  return { summary, failure: null };
}

/** @param {any} evidence @param {string | null} generationId */
function isMatchingVerifiedEvidence(evidence, generationId) {
  return (
    generationId !== null &&
    evidence !== null &&
    evidence?.classification === 'verified' &&
    evidence?.source === 'daemon' &&
    evidence?.generationId === generationId &&
    evidence?.activationId !== null
  );
}

/** @param {number} milliseconds */
function delay(milliseconds) {
  return new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, milliseconds);
    timer.unref?.();
  });
}

/** @param {any[]} input @param {number} limit */
function boundStepOutputs(input, limit) {
  const steps = structuredClone(input);
  const originalOutputs = steps.map(({ command }) => command.output);
  for (const { command } of steps) {
    command.output = {
      chunks: [],
      truncated: false,
      retainedBytes: 0,
      totalBytes: command.output.totalBytes,
    };
  }
  let remaining = limit;
  let truncated = originalOutputs.some(({ truncated }) => truncated);
  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const output = originalOutputs[stepIndex];
    const destination = steps[stepIndex]?.command.output;
    if (output === undefined || destination === undefined) continue;
    const chunks = output.chunks.filter(
      (/** @type {{stream: string, text: string}} */ chunk) =>
        chunk.stream !== 'system' ||
        chunk.text !== '[PortReeve: earlier output truncated]\n',
    );
    for (let chunkIndex = chunks.length - 1; chunkIndex >= 0; chunkIndex -= 1) {
      const chunk = chunks[chunkIndex];
      if (chunk === undefined) continue;
      const bytes = Buffer.from(chunk.text, 'utf8');
      if (remaining === 0) {
        truncated = true;
        continue;
      }
      const text =
        bytes.length <= remaining ? chunk.text : utf8Suffix(chunk.text, remaining);
      if (Buffer.byteLength(text, 'utf8') < bytes.length) truncated = true;
      destination.chunks.unshift({ ...chunk, text });
      const retainedBytes = Buffer.byteLength(text, 'utf8');
      destination.retainedBytes += retainedBytes;
      remaining -= retainedBytes;
    }
  }
  if (truncated) {
    const first = steps.find(({ command }) => command.output.chunks.length > 0);
    if (first !== undefined) {
      first.command.output.truncated = true;
      first.command.output.chunks.unshift({
        sequence: first.command.output.chunks[0]?.sequence ?? 0,
        stream: 'system',
        text: '[PortReeve: earlier output truncated]\n',
      });
    }
  }
  return steps;
}

/** @param {ReturnType<typeof lifecycleResult>} result */
function completionFromResult(result) {
  const command = result.steps.at(-1)?.command ?? null;
  return {
    outcome:
      result.outcome === 'timed-out'
        ? 'timed-out'
        : result.outcome === 'cancelled'
          ? 'cancelled'
          : result.outcome,
    exitCode: command?.exitCode ?? null,
    signal: command?.signal ?? null,
    degraded: result.degraded,
    beforeEvidence: result.beforeEvidence,
    afterEvidence: result.afterEvidence,
    failure:
      result.failure === null
        ? null
        : {
            step: safeCode(result.failure.step),
            code: safeCode(result.failure.code),
            message: result.failure.message.slice(0, 1_024),
          },
    integration: result.integration,
  };
}

/** @param {string} operation @param {string} step @param {string} code @param {string} message @param {Partial<{beforeEvidence: any, afterEvidence: any}>} [details] */
function failedResult(operation, step, code, message, details = {}) {
  return {
    operation,
    outcome: /** @type {const} */ ('failed'),
    degraded: false,
    environmentSource: null,
    beforeEvidence: details.beforeEvidence ?? null,
    afterEvidence: details.afterEvidence ?? null,
    steps: [],
    failure: { step, code, message },
    integration: null,
    daemonOperation: null,
  };
}

/** @param {unknown} error */
function isUnavailable(error) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'unavailable'
  );
}

/** @param {unknown} error */
function errorCode(error) {
  return error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
    ? safeCode(error.code)
    : 'internal';
}

/** @param {string} value */
function safeCode(value) {
  const normalized = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]/gu, '_')
    .slice(0, 64);
  return normalized || 'internal';
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {string} code @param {string} message */
function lifecycleError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
