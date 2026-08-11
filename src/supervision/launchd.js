// @ts-check

import { unlink } from 'node:fs/promises';
import { atomicWrite, fileExists } from './files.js';
import { assertCommandSucceeded, runCommand } from './command.js';

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
   * @param {import('./types.js').SupervisorDefinition} definition
   */
  renderDefinition(definition) {
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

  /** @param {import('./deadline.js').LifecycleDeadline} [context] */
  async state(context) {
    context?.assertActive('launchd-state');
    const installed = await fileExists(this.definitionPath);
    const result = await this.runner(
      'launchctl',
      ['print', this.service],
      context?.commandOptions('launchd-state'),
    );
    const active = result.code === 0;
    const pid = active ? parseLaunchdPid(result.stdout) : null;
    return { kind: this.kind, installed, active, mainPid: pid };
  }

  /** @param {string} content @param {import('./deadline.js').LifecycleDeadline} [context] */
  async installDefinition(content, context) {
    context?.assertActive('launchd-definition-install');
    await atomicWrite(this.definitionPath, content);
    context?.assertActive('launchd-definition-install');
  }

  /** @param {import('./deadline.js').LifecycleDeadline} [context] */
  async start(context) {
    let result = { code: 1, stdout: '', stderr: '' };
    for (let attempt = 0; attempt < 20; attempt += 1) {
      context?.assertActive('launchd-start');
      result = await this.runner(
        'launchctl',
        ['bootstrap', this.domain, this.definitionPath],
        context?.commandOptions('launchd-start'),
      );
      if (result.code === 0 || (await this.state(context)).active) {
        return;
      }
      if (result.code !== 5) {
        break;
      }
      await wait(context, 100, 'launchd-start');
    }
    assertCommandSucceeded(result, 'launchd start');
  }

  /** @param {import('./deadline.js').LifecycleDeadline} [context] */
  async stop(context) {
    const state = await this.state(context);
    if (!state.active) {
      return;
    }
    const result = await this.runner(
      'launchctl',
      ['bootout', this.service],
      context?.commandOptions('launchd-stop'),
    );
    assertCommandSucceeded(result, 'launchd stop');
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (!(await this.state(context)).active) {
        return;
      }
      await wait(context, 100, 'launchd-stop');
    }
    throw new Error('launchd did not finish unloading the PortReeve service.');
  }

  /** @param {import('./deadline.js').LifecycleDeadline} [context] */
  async uninstall(context) {
    await this.stop(context);
    context?.assertActive('launchd-uninstall');
    await unlink(this.definitionPath).catch((error) => {
      if (!(
        error instanceof Error &&
        'code' in error &&
        /** @type {{code?: string}} */ (error).code === 'ENOENT'
      )) {
        throw error;
      }
    });
    context?.assertActive('launchd-uninstall');
  }
}

/** @param {import('./deadline.js').LifecycleDeadline | undefined} context @param {number} milliseconds @param {string} layer */
function wait(context, milliseconds, layer) {
  return context === undefined
    ? new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
    : context.wait(milliseconds, layer);
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
