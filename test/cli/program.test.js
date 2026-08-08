// @ts-check

import { describe, expect, test } from 'bun:test';
import { createProgram } from '../../src/cli/program.js';

describe('PortReeve CLI', () => {
  test('exposes the stable command identity', () => {
    const program = createProgram();

    expect(program.name()).toBe('portreeve');
    expect(program.description()).toBe('The local authority for development ports');
    expect(program.version()).toBe('0.1.0');
  });

  test('keeps verified reclaim distinct from explicitly unsafe eviction', () => {
    const program = createProgram();
    const ports = program.commands.find((command) => command.name() === 'ports');
    expect(ports).toBeDefined();
    expect(ports?.commands.map((command) => command.name())).toEqual([
      'list',
      'inspect',
      'reclaim',
      'unsafe-evict',
    ]);
    const unsafeEviction = ports?.commands.find(
      (command) => command.name() === 'unsafe-evict',
    );
    expect(
      unsafeEviction?.options.find(({ long }) => long === '--unsafe-any-owner')
        ?.mandatory,
    ).toBe(true);
  });

  test('exposes the operational administration command families', () => {
    const program = createProgram();
    expect(program.commands.map((command) => command.name())).toEqual([
      'serve',
      'status',
      'purge',
      'install',
      'uninstall',
      'start',
      'stop',
      'stop-manual',
      'restart',
      'ports',
      'claims',
      'stacks',
      'config',
      'history',
      'logs',
    ]);
    const claims = program.commands.find((command) => command.name() === 'claims');
    expect(claims?.commands.map((command) => command.name())).toEqual([
      'list',
      'show',
      'reassign',
      'delete',
      'prune',
    ]);
    const stacks = program.commands.find((command) => command.name() === 'stacks');
    expect(stacks?.commands.map((command) => command.name())).toEqual([
      'apply',
      'list',
      'show',
      'status',
      'prepare',
      'begin',
      'activation',
      'generation',
      'renew',
      'confirm',
      'confirm-docker',
      'abandon',
      'skip',
      'end',
      'reconcile',
      'prune',
      'resolve',
      'snapshot',
    ]);
  });
});
