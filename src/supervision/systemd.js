// @ts-check

import { unlink } from 'node:fs/promises';
import { atomicWrite, fileExists } from './files.js';
import { assertCommandSucceeded, runCommand } from './command.js';

export const DEFAULT_SYSTEMD_UNIT = 'portreeve.service';

export class SystemdUserSupervisor {
  /**
   * @param {{
   *   definitionPath: string,
   *   unit?: string,
   *   runner?: typeof runCommand
   * }} options
   */
  constructor(options) {
    this.kind = 'systemd-user';
    this.definitionPath = options.definitionPath;
    this.unit = options.unit ?? DEFAULT_SYSTEMD_UNIT;
    this.runner = options.runner ?? runCommand;
  }

  /**
   * @param {import('./types.js').SupervisorDefinition} definition
   */
  renderDefinition(definition) {
    const command = [
      definition.executable,
      'serve',
      '--home',
      definition.applicationDirectory,
      '--socket',
      definition.socketPath,
    ]
      .map(quoteSystemdArgument)
      .join(' ');
    return `[Unit]
Description=Portreeve local development port authority

[Service]
Type=simple
Environment=PORTREEVE_SUPERVISED=1
ExecStart=${command}
Restart=on-failure
StandardOutput=append:${escapeSystemdSpecifiers(definition.standardOutputPath)}
StandardError=append:${escapeSystemdSpecifiers(definition.standardErrorPath)}

[Install]
WantedBy=default.target
`;
  }

  async state() {
    const installed = await fileExists(this.definitionPath);
    const activeResult = await this.runner('systemctl', [
      '--user',
      'is-active',
      '--quiet',
      this.unit,
    ]);
    let mainPid = null;
    if (activeResult.code === 0) {
      const pidResult = await this.runner('systemctl', [
        '--user',
        'show',
        '--property=MainPID',
        '--value',
        this.unit,
      ]);
      if (pidResult.code === 0 && /^\d+$/.test(pidResult.stdout.trim())) {
        const candidate = Number.parseInt(pidResult.stdout.trim(), 10);
        mainPid = candidate > 0 ? candidate : null;
      }
    }
    return {
      kind: this.kind,
      installed,
      active: activeResult.code === 0,
      mainPid,
    };
  }

  /** @param {string} content */
  async installDefinition(content) {
    await atomicWrite(this.definitionPath, content);
    assertCommandSucceeded(
      await this.runner('systemctl', ['--user', 'daemon-reload']),
      'systemd user daemon reload',
    );
    assertCommandSucceeded(
      await this.runner('systemctl', ['--user', 'enable', this.unit]),
      'systemd user enable',
    );
  }

  async start() {
    assertCommandSucceeded(
      await this.runner('systemctl', ['--user', 'start', this.unit]),
      'systemd user start',
    );
  }

  async stop() {
    const state = await this.state();
    if (!state.active) {
      return;
    }
    assertCommandSucceeded(
      await this.runner('systemctl', ['--user', 'stop', this.unit]),
      'systemd user stop',
    );
  }

  async uninstall() {
    await this.stop();
    await this.runner('systemctl', ['--user', 'disable', this.unit]);
    await unlink(this.definitionPath).catch((error) => {
      if (!(
        error instanceof Error &&
        'code' in error &&
        /** @type {{code?: string}} */ (error).code === 'ENOENT'
      )) {
        throw error;
      }
    });
    assertCommandSucceeded(
      await this.runner('systemctl', ['--user', 'daemon-reload']),
      'systemd user daemon reload',
    );
  }
}

/** @param {string} value */
function quoteSystemdArgument(value) {
  return `"${value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('%', '%%')}"`;
}

/** @param {string} value */
function escapeSystemdSpecifiers(value) {
  return value.replaceAll('%', '%%');
}
