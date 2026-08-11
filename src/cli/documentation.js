// @ts-check

export const CLI_SAFETY_CATEGORIES = Object.freeze({
  READ_ONLY: 'read-only-or-local-generation',
  COORDINATION: 'ordinary-coordination-mutation',
  CONSEQUENTIAL: 'evidence-bound-consequential-mutation',
  SERVICE_ADMINISTRATION: 'service-administration',
  UNSAFE_OVERRIDE: 'unsafe-override',
});

export const CLI_SAFETY_LABELS = Object.freeze({
  [CLI_SAFETY_CATEGORIES.READ_ONLY]: 'Read-only or local generation',
  [CLI_SAFETY_CATEGORIES.COORDINATION]: 'Ordinary coordination mutation',
  [CLI_SAFETY_CATEGORIES.CONSEQUENTIAL]: 'Evidence-bound consequential mutation',
  [CLI_SAFETY_CATEGORIES.SERVICE_ADMINISTRATION]: 'Service administration',
  [CLI_SAFETY_CATEGORIES.UNSAFE_OVERRIDE]: 'Unsafe override',
});

const READ = CLI_SAFETY_CATEGORIES.READ_ONLY;
const COORDINATION = CLI_SAFETY_CATEGORIES.COORDINATION;
const CONSEQUENTIAL = CLI_SAFETY_CATEGORIES.CONSEQUENTIAL;
const ADMIN = CLI_SAFETY_CATEGORIES.SERVICE_ADMINISTRATION;
const UNSAFE = CLI_SAFETY_CATEGORIES.UNSAFE_OVERRIDE;

/**
 * Documentation facts that Commander cannot derive from flags alone. Keys omit
 * the root `portreeve` command so they stay stable if the executable filename
 * is qualified by a caller.
 */
export const CLI_DOCUMENTATION = Object.freeze({
  serve: entry('server', ADMIN, 'foreground-server'),
  'mcp serve': entry('mcp', ADMIN, 'mcp-stdio'),
  'mcp setup': entry('mcp', READ, 'standard'),
  status: entry('server', READ, 'standard'),
  purge: entry('server', ADMIN, 'standard'),
  install: entry('server', ADMIN, 'standard'),
  uninstall: entry('server', ADMIN, 'standard'),
  start: entry('server', ADMIN, 'standard'),
  stop: entry('server', ADMIN, 'standard'),
  'stop-manual': entry('server', ADMIN, 'standard'),
  restart: entry('server', ADMIN, 'standard'),
  'ports list': entry('ports', READ, 'standard'),
  'ports inspect': entry('ports', READ, 'standard'),
  'ports reclaim': entry('ports', CONSEQUENTIAL, 'standard'),
  'ports unsafe-evict': entry('ports', UNSAFE, 'standard'),
  'claims list': entry('claims', READ, 'standard'),
  'claims show': entry('claims', READ, 'standard'),
  'claims reassign': entry('claims', CONSEQUENTIAL, 'standard'),
  'claims delete': entry('claims', CONSEQUENTIAL, 'standard'),
  'claims prune': entry('claims', CONSEQUENTIAL, 'standard'),
  'stacks apply': entry('stacks', COORDINATION, 'standard'),
  'stacks list': entry('stacks', READ, 'standard'),
  'stacks show': entry('stacks', READ, 'standard'),
  'stacks status': entry('stacks', READ, 'standard'),
  'stacks prepare': entry('stacks', COORDINATION, 'standard'),
  'stacks begin': entry('stacks', COORDINATION, 'standard'),
  'stacks activation': entry('stacks', READ, 'standard'),
  'stacks generation': entry('stacks', READ, 'standard'),
  'stacks renew': entry('stacks', COORDINATION, 'standard'),
  'stacks confirm': entry('stacks', COORDINATION, 'standard'),
  'stacks confirm-docker': entry('stacks', COORDINATION, 'standard'),
  'stacks abandon': entry('stacks', COORDINATION, 'standard'),
  'stacks skip': entry('stacks', COORDINATION, 'standard'),
  'stacks end': entry('stacks', COORDINATION, 'standard'),
  'stacks reconcile': entry('stacks', COORDINATION, 'standard'),
  'stacks prune': entry('stacks', CONSEQUENTIAL, 'standard'),
  'stacks resolve': entry('stacks', READ, 'standard'),
  'stacks snapshot': entry('stacks', READ, 'standard'),
  'launcher init': entry('launcher', COORDINATION, 'standard'),
  'launcher validate': entry('launcher', READ, 'standard'),
  'launcher trust': entry('launcher', COORDINATION, 'standard'),
  'launcher start': entry('launcher', COORDINATION, 'standard'),
  'launcher stop': entry('launcher', COORDINATION, 'standard'),
  'launcher restart': entry('launcher', COORDINATION, 'standard'),
  'launcher status': entry('launcher', COORDINATION, 'standard'),
  'config get': entry('config', READ, 'standard'),
  'config set': entry('config', COORDINATION, 'standard'),
  history: entry('observability', READ, 'standard'),
  logs: entry('observability', READ, 'standard'),
});

const DOCUMENTATION = Symbol('portreeve.cli.documentation');

/** @param {import('commander').Command} program */
export function annotateCliProgram(program) {
  const metadata =
    /** @type {Record<string, {family: string, safety: string, outputProfile: string}>} */ (
      CLI_DOCUMENTATION
    );
  for (const command of leafCommands(program)) {
    const key = commandPath(command);
    const documentation = metadata[key];
    if (documentation === undefined) {
      throw new Error(`Missing CLI documentation metadata for: portreeve ${key}`);
    }
    Object.defineProperty(command, DOCUMENTATION, {
      value: documentation,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }

  const leaves = new Set(leafCommands(program).map(commandPath));
  const stale = Object.keys(CLI_DOCUMENTATION).filter((key) => !leaves.has(key));
  if (stale.length > 0) {
    throw new Error(`Stale CLI documentation metadata: ${stale.join(', ')}`);
  }
  return program;
}

/** @param {import('commander').Command} program */
export function cliDocumentationCatalog(program) {
  return leafCommands(program).map((command) => {
    const documentation =
      /** @type {{family: string, safety: string, outputProfile: string}|undefined} */ (
        /** @type {any} */ (command)[DOCUMENTATION]
      );
    if (documentation === undefined) {
      throw new Error(`Unannotated CLI command: ${command.name()}`);
    }
    const key = commandPath(command);
    return Object.freeze({
      id: `cli-command-portreeve-${slug(key)}`,
      key,
      path: `portreeve ${key}`,
      family: documentation.family,
      safety: documentation.safety,
      safetyLabel: /** @type {Record<string, string>} */ (CLI_SAFETY_LABELS)[
        documentation.safety
      ],
      description: command.description(),
      synopsis: commandSynopsis(command),
      arguments: command.registeredArguments.map((argument) => ({
        name: argument.name(),
        required: argument.required,
        variadic: argument.variadic,
        description: argument.description,
        defaultValue: argument.defaultValue ?? null,
      })),
      options: command.options.map((option) => ({
        flags: option.flags,
        required: option.required,
        optional: option.optional,
        variadic: option.variadic,
        mandatory: option.mandatory,
        description: option.description,
        defaultValue: option.defaultValue ?? null,
        choices: option.argChoices ?? [],
      })),
      environment: environmentNotes(command),
      outputProfile: documentation.outputProfile,
      exitStatusProfile: documentation.outputProfile,
    });
  });
}

/** @param {import('commander').Command} command */
function commandPath(command) {
  const names = [];
  for (let current = command; current.parent !== null; current = current.parent) {
    names.unshift(current.name());
  }
  return names.join(' ');
}

/** @param {import('commander').Command} command */
function commandSynopsis(command) {
  const argumentsText = command.registeredArguments
    .map((argument) => {
      const name = argument.variadic ? `${argument.name()}...` : argument.name();
      return argument.required ? `<${name}>` : `[${name}]`;
    })
    .join(' ');
  return `${fullCommandName(command)}${argumentsText === '' ? '' : ` ${argumentsText}`} [options]`;
}

/** @param {import('commander').Command} command */
function fullCommandName(command) {
  const names = [];
  for (
    let current = /** @type {import('commander').Command|null} */ (command);
    current !== null;
    current = current.parent
  ) {
    names.unshift(current.name());
  }
  return names.join(' ');
}

/** @param {import('commander').Command} program */
function leafCommands(program) {
  /** @type {import('commander').Command[]} */
  const leaves = [];
  const visit = (/** @type {import('commander').Command} */ command) => {
    if (command.commands.length === 0) {
      leaves.push(command);
      return;
    }
    command.commands.forEach(visit);
  };
  program.commands.forEach(visit);
  return leaves;
}

/** @param {import('commander').Command} command */
function environmentNotes(command) {
  const flags = new Set(
    command.options.flatMap((option) => option.flags.split(/[, ]+/u)),
  );
  const notes = [];
  if (flags.has('--home')) {
    notes.push(
      'Uses the platform PortReeve application directory unless --home is set.',
    );
  }
  if (flags.has('--socket')) {
    notes.push('Uses the platform PortReeve Unix socket unless --socket is set.');
  }
  return notes;
}

/** @param {string} family @param {string} safety @param {string} outputProfile */
function entry(family, safety, outputProfile) {
  return Object.freeze({ family, safety, outputProfile });
}

/** @param {string} value */
function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}
