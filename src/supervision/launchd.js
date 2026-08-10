// @ts-check

import { unlink } from 'node:fs/promises';
import { atomicWrite, fileExists } from './files.js';
import { assertCommandSucceeded, runCommand } from './command.js';
import { SupervisorDefinitionSchema } from './schemas.js';

export const DEFAULT_LAUNCHD_LABEL = 'com.portreeve.server';

export class LaunchdSupervisor {
  /**
   * @param {{
   *   uid: number,
   *   definitionPath: string,
   *   label?: string,
   *   runner?: typeof runCommand
   * }} options
   */
  constructor(options) {
    this.kind = 'launchd';
    this.uid = options.uid;
    this.definitionPath = options.definitionPath;
    this.label = options.label ?? DEFAULT_LAUNCHD_LABEL;
    this.runner = options.runner ?? runCommand;
    this.domain = `gui/${this.uid}`;
    this.service = `${this.domain}/${this.label}`;
  }

  /**
   * @param {import('./types.js').SupervisorDefinition} requestedDefinition
   */
  renderDefinition(requestedDefinition) {
    const definition = SupervisorDefinitionSchema.parse(requestedDefinition);
    const argumentsXml = [
      definition.executable,
      'serve',
      '--home',
      definition.applicationDirectory,
      '--socket',
      definition.socketPath,
    ]
      .map((argument) => `      <string>${escapeXml(argument)}</string>`)
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${escapeXml(this.label)}</string>
    <key>ProgramArguments</key>
    <array>
${argumentsXml}
    </array>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PORTREEVE_SUPERVISED</key>
      <string>1</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${escapeXml(definition.standardOutputPath)}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(definition.standardErrorPath)}</string>
  </dict>
</plist>
`;
  }

  async state() {
    const installed = await fileExists(this.definitionPath);
    const result = await this.runner('launchctl', ['print', this.service]);
    const active = result.code === 0;
    const pid = active ? parseLaunchdPid(result.stdout) : null;
    return { kind: this.kind, installed, active, mainPid: pid };
  }

  /** @param {string} content */
  async installDefinition(content) {
    await atomicWrite(this.definitionPath, content);
  }

  async start() {
    let result = { code: 1, stdout: '', stderr: '' };
    for (let attempt = 0; attempt < 20; attempt += 1) {
      result = await this.runner('launchctl', [
        'bootstrap',
        this.domain,
        this.definitionPath,
      ]);
      if (result.code === 0 || (await this.state()).active) {
        return;
      }
      if (result.code !== 5) {
        break;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
    assertCommandSucceeded(result, 'launchd start');
  }

  async stop() {
    const state = await this.state();
    if (!state.active) {
      return;
    }
    const result = await this.runner('launchctl', ['bootout', this.service]);
    assertCommandSucceeded(result, 'launchd stop');
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (!(await this.state()).active) {
        return;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
    throw new Error('launchd did not finish unloading the PortReeve service.');
  }

  async uninstall() {
    await this.stop();
    await unlink(this.definitionPath).catch((error) => {
      if (!(
        error instanceof Error &&
        'code' in error &&
        /** @type {{code?: string}} */ (error).code === 'ENOENT'
      )) {
        throw error;
      }
    });
  }
}

/** @param {string} output */
function parseLaunchdPid(output) {
  const match = output.match(/^\s*pid\s*=\s*(\d+)\s*$/m);
  return match === null ? null : Number.parseInt(match[1] ?? '', 10);
}

/** @param {string} value */
function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
