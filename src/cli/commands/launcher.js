// @ts-check

import { createInterface } from 'node:readline/promises';
import { join, relative } from 'node:path';
import { PortreeveClientError } from '../../../packages/client/src/index.js';
import { resolveLauncherShell } from '../../launcher/command-session.js';
import {
  LAUNCHER_DEFINITION_FILENAME,
  normalizeLauncherDefinition,
} from '../../launcher/definition.js';
import {
  discoverLauncherCommands,
  suggestLauncherEnvironment,
} from '../../launcher/discovery.js';
import {
  createLauncherDocument,
  inspectLauncherFile,
  readLauncherDocument,
  resolveLauncherWorkingDirectory,
} from '../../launcher/document.js';
import { createLauncherRuntime } from '../../launcher/runtime.js';
import { EXIT_CODES } from '../../protocol/constants.js';
import { CliUsageError, setExitCode } from '../exit.js';
import {
  readLocalStackDefinition,
  selectAppliedLauncherStack,
  selectLauncherRoot,
} from '../launcher-selection.js';
import { renderOutput } from '../output/render.js';

/** @typedef {{home?: string, socket?: string, stackRoot?: string, json?: boolean}} LauncherOptions */
/** @typedef {{interactive?: boolean, question?: (prompt: string) => Promise<string>, write?: (text: string) => void}} Interaction */

/** @param {LauncherOptions} options */
export async function validateLauncherCommand(options) {
  const runtime = await createLauncherRuntime(options);
  const stackRoot = await selectLauncherRoot(options);
  const localStack = await readLocalStackDefinition(stackRoot);
  const launcher = await readLauncherForCli(stackRoot, localStack.definition);
  let applied = null;
  let daemonAvailable = true;
  try {
    const stacks = await runtime.client.listStacks({ stackRoot });
    if (stacks.length > 1) {
      throw new CliUsageError(
        `More than one applied stack is registered for ${stackRoot}; launcher selection is ambiguous.`,
      );
    }
    applied = stacks[0] ?? null;
  } catch (error) {
    if (!isUnavailable(error)) throw error;
    daemonAvailable = false;
  }
  const result = {
    valid: true,
    stackRoot,
    filename: launcher.filename,
    revision: launcher.revision,
    canonical: launcher.sourceContent === launcher.canonicalContent,
    workingDirectory: launcher.workingDirectory,
    definition: launcher.definition,
    applied: applied !== null,
    appliedRevisionCurrent:
      applied === null ? null : applied.currentRevision === localStack.revision,
    daemonAvailable,
    trusted: await runtime.stateStore.isTrusted(stackRoot, launcher.revision),
  };
  renderOutput(options.json ?? false, 'launcher', result, [
    `Valid launcher: ${launcher.filename}`,
    `Revision: ${launcher.revision}`,
    `Working directory: ${launcher.workingDirectory}`,
    `Applied: ${result.applied ? 'yes' : 'no'}`,
    `Trusted: ${result.trusted ? 'yes' : 'no'}`,
    `Canonical JSON: ${result.canonical ? 'yes' : 'no'}`,
    ...(daemonAvailable ? [] : ['PortReeve service: unavailable']),
  ]);
}

/** @param {LauncherOptions} options @param {Interaction} [interaction] */
export async function trustLauncherCommand(options, interaction = {}) {
  const runtime = await createLauncherRuntime(options);
  const stackRoot = await selectLauncherRoot(options);
  const selected = await selectAppliedLauncherStack(
    stackRoot,
    runtime.client,
    runtime.stateStore,
  );
  const launcher = await readLauncherForCli(stackRoot, selected.stack.definition);
  const terminal = interactionFor(options, interaction);
  try {
    terminal.write(`${trustReview(launcher)}\n`);
    const confirmed = await askYesNo(
      terminal,
      `Trust this exact launcher revision? [y/N] `,
      false,
    );
    if (!confirmed) {
      setExitCode(EXIT_CODES.stateDifference);
      renderOutput(
        options.json ?? false,
        'result',
        {
          trusted: false,
          stackRoot,
          filename: launcher.filename,
          revision: launcher.revision,
        },
        ['Launcher trust cancelled; no trust state changed.'],
      );
      return;
    }
    await runtime.stateStore.trust(stackRoot, launcher.revision);
    renderOutput(
      options.json ?? false,
      'result',
      {
        trusted: true,
        stackRoot,
        filename: launcher.filename,
        revision: launcher.revision,
      },
      [`Trusted launcher revision ${launcher.revision}.`],
    );
  } finally {
    terminal.close();
  }
}

/** @param {LauncherOptions} options @param {Interaction} [interaction] */
export async function initLauncherCommand(options, interaction = {}) {
  const runtime = await createLauncherRuntime(options);
  const stackRoot = await selectLauncherRoot(options);
  const selected = await selectAppliedLauncherStack(
    stackRoot,
    runtime.client,
    runtime.stateStore,
  );
  const existing = await inspectLauncherFile(
    join(stackRoot, LAUNCHER_DEFINITION_FILENAME),
  );
  if (existing.kind !== 'missing') {
    throw new CliUsageError(
      `${LAUNCHER_DEFINITION_FILENAME} already exists at ${stackRoot}; edit it directly, then run launcher validate and launcher trust.`,
    );
  }
  const terminal = interactionFor(options, interaction);
  try {
    const workingDirectoryInput = await askWithDefault(
      terminal,
      'Working directory relative to the stack root',
      '.',
    );
    let workingDirectory;
    try {
      workingDirectory = await resolveLauncherWorkingDirectory(
        stackRoot,
        workingDirectoryInput,
      );
    } catch (error) {
      throw usageFrom(error, 'Invalid launcher working directory');
    }
    const workingDirectoryRelative = relative(stackRoot, workingDirectory) || '.';
    const suggestions = await discoverLauncherCommands(workingDirectory);
    terminal.write(`${suggestionReview(suggestions)}\n`);
    const start = await askRequiredCommand(
      terminal,
      'Start command',
      suggestions.operations.start.suggestion?.command,
    );
    const stop = await askRequiredCommand(
      terminal,
      'Stop command',
      suggestions.operations.stop.suggestion?.command,
    );
    const restart = await askOptionalCommand(
      terminal,
      'Restart command (blank composes Stop then Start)',
      suggestions.operations.restart.suggestion?.command,
    );
    const status = await askOptionalCommand(
      terminal,
      'Status command (blank uses PortReeve evidence only)',
      suggestions.operations.status.suggestion?.command,
    );
    const shell = await askChoice(
      terminal,
      'Shell (system, bash, zsh)',
      ['system', 'bash', 'zsh'],
      'system',
    );
    const startMode = await askChoice(
      terminal,
      'Start behavior (finite, attached)',
      ['finite', 'attached'],
      'finite',
    );
    const integrationMode = await askChoice(
      terminal,
      'Integration (command-only, verified-activation)',
      ['command-only', 'verified-activation'],
      'command-only',
    );
    terminal.write(
      `Resolved shell: ${resolveLauncherShell(shell)} (${shell})\nResolved working directory: ${workingDirectory}\n`,
    );
    const suggestedEnvironment = suggestLauncherEnvironment(selected.stack.definition);
    terminal.write(`${environmentReview(suggestedEnvironment)}\n`);
    const useSuggestedEnvironment = await askYesNo(
      terminal,
      'Include these endpoint environment mappings? [Y/n] ',
      true,
    );
    const definition = {
      version: 1,
      integration: { mode: integrationMode },
      shell,
      workingDirectory: workingDirectoryRelative,
      operations: {
        start: { command: start, mode: startMode },
        stop: { command: stop },
        ...(restart === null ? {} : { restart: { command: restart } }),
        ...(status === null ? {} : { status: { command: status } }),
      },
      environment: useSuggestedEnvironment ? suggestedEnvironment : [],
    };
    const preview = normalizeLauncherDefinition(definition);
    terminal.write(
      `\nExact ${LAUNCHER_DEFINITION_FILENAME} preview:\n${preview.content}`,
    );
    const confirmed = await askYesNo(
      terminal,
      'Create this file and trust its exact revision? [y/N] ',
      false,
    );
    if (!confirmed) {
      setExitCode(EXIT_CODES.stateDifference);
      renderOutput(
        options.json ?? false,
        'result',
        {
          created: false,
          trusted: false,
          stackRoot,
          revision: preview.revision,
          definition: preview.definition,
        },
        ['Launcher initialization cancelled; no file was created.'],
      );
      return;
    }
    let launcher;
    try {
      launcher = await createLauncherDocument(stackRoot, preview.definition, {
        stackDefinition: selected.stack.definition,
      });
    } catch (error) {
      throw usageFrom(error, `Unable to create ${LAUNCHER_DEFINITION_FILENAME}`);
    }
    await runtime.stateStore.trust(stackRoot, launcher.revision);
    renderOutput(
      options.json ?? false,
      'result',
      {
        created: true,
        trusted: true,
        stackRoot,
        filename: launcher.filename,
        revision: launcher.revision,
        definition: launcher.definition,
        suggestions,
      },
      [
        `Created ${launcher.filename}.`,
        `Trusted launcher revision ${launcher.revision}.`,
      ],
    );
  } finally {
    terminal.close();
  }
}

/** @param {'start'|'stop'|'restart'|'status'} operation @param {LauncherOptions & {runStartAnyway?: boolean, allowDegraded?: boolean}} options @param {Interaction} [interaction] @param {any} [runtimeOverride] */
export async function runLauncherCommand(
  operation,
  options,
  interaction = {},
  runtimeOverride,
) {
  const runtime = runtimeOverride ?? (await createLauncherRuntime(options));
  const stackRoot = await selectLauncherRoot(options);
  const selected = await selectAppliedLauncherStack(
    stackRoot,
    runtime.client,
    runtime.stateStore,
    { allowCached: true },
  );
  const launcher = await readLauncherForCli(stackRoot, selected.stack.definition);
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  const execute = (extra = {}) =>
    runtime.lifecycleService.execute({
      operation,
      stack: selected.stack,
      launcher,
      runStartAnyway: options.runStartAnyway ?? false,
      allowDegraded: options.allowDegraded ?? false,
      signal: controller.signal,
      ...extra,
      ...(options.json
        ? {}
        : {
            onOutput: (/** @type {{text: string}} */ { text }) =>
              process.stdout.write(text),
          }),
    });
  try {
    let result = await execute();
    if (
      result.failure?.code === 'launcher_start_anyway_required' &&
      options.runStartAnyway !== true &&
      canPrompt(options, interaction)
    ) {
      const terminal = interactionFor(options, interaction);
      try {
        if (
          await askYesNo(
            terminal,
            'Run Start Anyway using this generation? [y/N] ',
            false,
          )
        ) {
          result = await execute({ runStartAnyway: true });
        }
      } finally {
        terminal.close();
      }
    } else if (
      result.failure?.code === 'launcher_degraded_confirmation_required' &&
      options.allowDegraded !== true &&
      canPrompt(options, interaction)
    ) {
      const terminal = interactionFor(options, interaction);
      try {
        if (
          await askYesNo(terminal, 'Stop without daemon coordination? [y/N] ', false)
        ) {
          result = await execute({ allowDegraded: true });
        }
      } finally {
        terminal.close();
      }
    }
    setLifecycleExitCode(result);
    renderLauncherResult(options.json ?? false, result);
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
}

/** @param {LauncherOptions & {runStartAnyway?: boolean}} options */
export const startLauncherCommand = (options) => runLauncherCommand('start', options);
/** @param {LauncherOptions & {allowDegraded?: boolean}} options */
export const stopLauncherCommand = (options) => runLauncherCommand('stop', options);
/** @param {LauncherOptions} options */
export const restartLauncherCommand = (options) =>
  runLauncherCommand('restart', options);
/** @param {LauncherOptions} options */
export const statusLauncherCommand = (options) => runLauncherCommand('status', options);

/** @param {string} stackRoot @param {unknown} stackDefinition */
async function readLauncherForCli(stackRoot, stackDefinition) {
  try {
    return await readLauncherDocument(stackRoot, { stackDefinition });
  } catch (error) {
    throw usageFrom(error, `Unable to use ${LAUNCHER_DEFINITION_FILENAME}`);
  }
}

/** @param {boolean} json @param {any} result */
function renderLauncherResult(json, result) {
  const evidence = result.afterEvidence ?? result.beforeEvidence;
  renderOutput(json, 'result', result, [
    `Launcher ${result.operation}: ${result.outcome}${result.degraded ? ' (degraded)' : ''}.`,
    ...(evidence === null
      ? []
      : [
          `Evidence: ${evidence.classification} from ${evidence.source} at ${evidence.observedAt}.`,
        ]),
    ...(result.failure === null
      ? []
      : [
          `Failure: ${result.failure.code} at ${result.failure.step}: ${result.failure.message}`,
        ]),
    ...result.steps.map(
      (/** @type {{step: string, command: any}} */ { step, command }) =>
        `${step}: ${command.outcome}${command.exitCode === null ? '' : ` (exit ${String(command.exitCode)})`}`,
    ),
  ]);
}

/** @param {any} result */
function setLifecycleExitCode(result) {
  if (result.outcome === 'succeeded') return;
  const code = result.failure?.code ?? '';
  if (code === 'launcher_daemon_required' || code === 'unavailable') {
    setExitCode(EXIT_CODES.unavailable);
  } else if (
    code.includes('evidence') ||
    code.includes('untrusted') ||
    code.includes('required') ||
    code.includes('conflict') ||
    code.includes('changed')
  ) {
    setExitCode(EXIT_CODES.conflict);
  } else {
    setExitCode(EXIT_CODES.stateDifference);
  }
}

/** @param {LauncherOptions} options @param {Interaction} interaction */
function interactionFor(options, interaction) {
  if (!canPrompt(options, interaction)) {
    throw new CliUsageError(
      'This launcher action requires an interactive terminal; no noninteractive trust bypass is available.',
    );
  }
  if (interaction.question !== undefined) {
    return {
      question: interaction.question,
      write: interaction.write ?? (() => {}),
      close() {},
    };
  }
  const terminal = createInterface({
    input: process.stdin,
    output: options.json ? process.stderr : process.stdout,
  });
  return {
    question: (/** @type {string} */ prompt) => terminal.question(prompt),
    write: (/** @type {string} */ text) =>
      (options.json ? process.stderr : process.stdout).write(text),
    close: () => terminal.close(),
  };
}

/** @param {LauncherOptions} options @param {Interaction} interaction */
function canPrompt(options, interaction) {
  return interaction.interactive === true || process.stdin.isTTY === true;
}

/** @param {{question: Function}} terminal @param {string} prompt @param {boolean} defaultValue */
async function askYesNo(terminal, prompt, defaultValue) {
  const answer = (await terminal.question(prompt)).trim().toLowerCase();
  if (answer === '') return defaultValue;
  if (['y', 'yes'].includes(answer)) return true;
  if (['n', 'no'].includes(answer)) return false;
  throw new CliUsageError('Expected yes or no.');
}

/** @param {{question: Function}} terminal @param {string} label @param {string} defaultValue */
async function askWithDefault(terminal, label, defaultValue) {
  const answer = (await terminal.question(`${label} [${defaultValue}]: `)).trim();
  return answer === '' ? defaultValue : answer;
}

/** @param {{question: Function}} terminal @param {string} label @param {string|undefined} suggested */
async function askRequiredCommand(terminal, label, suggested) {
  const answer = await askWithDefault(terminal, label, suggested ?? '');
  if (answer.trim() === '') throw new CliUsageError(`${label} is required.`);
  return answer;
}

/** @param {{question: Function}} terminal @param {string} label @param {string|undefined} suggested */
async function askOptionalCommand(terminal, label, suggested) {
  const answer = await askWithDefault(terminal, label, suggested ?? '');
  return answer.trim() === '' ? null : answer;
}

/** @param {{question: Function}} terminal @param {string} label @param {string[]} choices @param {string} defaultValue */
async function askChoice(terminal, label, choices, defaultValue) {
  const answer = await askWithDefault(terminal, label, defaultValue);
  if (!choices.includes(answer)) {
    throw new CliUsageError(`${label} must be one of: ${choices.join(', ')}.`);
  }
  return answer;
}

/** @param {any} launcher */
function trustReview(launcher) {
  const operations = Object.entries(launcher.definition.operations)
    .map(([name, operation]) => {
      const timeout =
        operation.timeoutSeconds === undefined
          ? (operation.mode ?? 'finite')
          : `${String(operation.timeoutSeconds)}s`;
      return `  ${name} [${timeout}]: ${operation.command}`;
    })
    .join('\n');
  return [
    'Launcher trust review',
    `Root: ${launcher.stackRoot}`,
    `Revision: ${launcher.revision}`,
    `Shell: ${resolveLauncherShell(launcher.definition.shell)} (${launcher.definition.shell})`,
    `Working directory: ${launcher.workingDirectory}`,
    'Commands:',
    operations,
  ].join('\n');
}

/** @param {any} suggestions */
function suggestionReview(suggestions) {
  const lines = [
    'Command suggestions (manifest files were inspected, never executed):',
  ];
  for (const operation of ['start', 'stop', 'restart', 'status']) {
    const operationSuggestions = suggestions.operations[operation];
    const candidate = operationSuggestions.suggestion;
    if (candidate !== null) {
      lines.push(
        `  ${operation}: ${candidate.command} (${candidate.provenance.kind}: ${candidate.provenance.filename})`,
      );
      continue;
    }
    lines.push(
      `  ${operation}: ${operationSuggestions.candidates.length === 0 ? 'none' : 'ambiguous'} (enter a command)`,
    );
    for (const alternative of operationSuggestions.candidates) {
      lines.push(
        `    candidate: ${alternative.command} (${alternative.provenance.kind}: ${alternative.provenance.filename})`,
      );
    }
  }
  return lines.join('\n');
}

/** @param {any[]} environment */
function environmentReview(environment) {
  return [
    'Suggested endpoint environment:',
    ...(environment.length === 0
      ? ['  none']
      : environment.map(
          ({ name, endpoint, value }) =>
            `  ${name} <- ${endpoint.component}.${endpoint.endpoint} (${value})`,
        )),
  ].join('\n');
}

/** @param {unknown} error @param {string} prefix */
function usageFrom(error, prefix) {
  return new CliUsageError(
    `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
    error !== null && typeof error === 'object' && 'code' in error
      ? { cause: error.code }
      : {},
  );
}

/** @param {unknown} error */
function isUnavailable(error) {
  return error instanceof PortreeveClientError && error.code === 'unavailable';
}
