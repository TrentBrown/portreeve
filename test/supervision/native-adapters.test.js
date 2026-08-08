// @ts-check

import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand } from '../../src/supervision/command.js';
import { LaunchdSupervisor } from '../../src/supervision/launchd.js';
import { SystemdUserSupervisor } from '../../src/supervision/systemd.js';

const definition = {
  executable: '/Users/Example User/.portreeve/bin/portreeve',
  applicationDirectory: '/Users/Example User/PortReeve & Data',
  socketPath: '/Users/Example User/PortReeve & Data/server.sock',
  standardOutputPath: '/tmp/portreeve % output.log',
  standardErrorPath: '/tmp/portreeve error.log',
};

describe('native supervisor adapters', () => {
  test('reports an unavailable native command without throwing', async () => {
    const result = await runCommand('portreeve-command-that-does-not-exist', []);

    expect(result).toEqual({
      code: 127,
      stdout: '',
      stderr: 'Executable not found in $PATH: "portreeve-command-that-does-not-exist"',
    });
  });

  test('renders and controls a launchd per-user agent', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'portreeve-launchd-'));
    const definitionPath = join(directory, 'com.portreeve.test.plist');
    /** @type {Array<[string, string[]]>} */
    const calls = [];
    let active = false;
    let bootstrapAttempts = 0;
    /** @type {(executable: string, args: string[]) => Promise<{code: number, stdout: string, stderr: string}>} */
    const runner = async (executable, args) => {
      calls.push([executable, args]);
      if (args[0] === 'print') {
        return active
          ? { code: 0, stdout: 'service = {\n  pid = 4242\n}\n', stderr: '' }
          : { code: 113, stdout: '', stderr: 'not found' };
      }
      if (args[0] === 'bootstrap') {
        bootstrapAttempts += 1;
        if (bootstrapAttempts === 1) {
          return { code: 5, stdout: '', stderr: 'Input/output error' };
        }
        active = true;
      }
      if (args[0] === 'bootout') {
        active = false;
      }
      return { code: 0, stdout: '', stderr: '' };
    };
    const supervisor = new LaunchdSupervisor({
      uid: 501,
      definitionPath,
      label: 'com.portreeve.test',
      runner,
    });

    try {
      const content = supervisor.renderDefinition(definition);
      expect(content).toContain('<string>com.portreeve.test</string>');
      expect(content).toContain('PortReeve &amp; Data');
      expect(content).toContain('<key>PORTREEVE_SUPERVISED</key>');
      await supervisor.installDefinition(content);
      expect((await supervisor.state()).installed).toBe(true);
      await supervisor.start();
      expect(await supervisor.state()).toEqual({
        kind: 'launchd',
        installed: true,
        active: true,
        mainPid: 4242,
      });
      await supervisor.stop();
      expect(active).toBe(false);
      expect(bootstrapAttempts).toBe(2);
      expect(calls).toContainEqual([
        'launchctl',
        ['bootstrap', 'gui/501', definitionPath],
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('renders, enables, and controls a systemd user unit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'portreeve-systemd-'));
    const definitionPath = join(directory, 'portreeve.service');
    /** @type {string[][]} */
    const calls = [];
    let active = false;
    /** @type {(_executable: string, args: string[]) => Promise<{code: number, stdout: string, stderr: string}>} */
    const runner = async (_executable, args) => {
      calls.push(args);
      if (args.includes('is-active')) {
        return { code: active ? 0 : 3, stdout: '', stderr: '' };
      }
      if (args.includes('show')) {
        return { code: 0, stdout: '31337\n', stderr: '' };
      }
      if (args.includes('start')) {
        active = true;
      }
      if (args.includes('stop')) {
        active = false;
      }
      return { code: 0, stdout: '', stderr: '' };
    };
    const supervisor = new SystemdUserSupervisor({
      definitionPath,
      unit: 'portreeve-test.service',
      runner,
    });

    try {
      const content = supervisor.renderDefinition(definition);
      expect(content).toContain('Environment=PORTREEVE_SUPERVISED=1');
      expect(content).toContain('UMask=0077');
      expect(content).toContain('%%');
      expect(content).toContain('"/Users/Example User/.portreeve/bin/portreeve"');
      await supervisor.installDefinition(content);
      expect(await readFile(definitionPath, 'utf8')).toBe(content);
      expect(calls).toContainEqual(['--user', 'enable', 'portreeve-test.service']);
      await supervisor.start();
      expect(await supervisor.state()).toEqual({
        kind: 'systemd-user',
        installed: true,
        active: true,
        mainPid: 31337,
      });
      await supervisor.uninstall();
      expect(active).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
