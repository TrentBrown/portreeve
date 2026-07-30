// @ts-check

import {
  appendFileSync,
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { DiagnosticLogEntrySchema } from '../protocol/schemas.js';

export class DiagnosticLog {
  /**
   * @param {{
   *   path: string,
   *   settings: () => {
   *     diagnosticLogMaximumBytes: number,
   *     diagnosticLogFiles: number
   *   },
   *   now?: () => Date
   * }} options
   */
  constructor({ path, settings, now = () => new Date() }) {
    this.path = path;
    this.settings = settings;
    this.now = now;
    validateExistingLog(path);
  }

  /**
   * @param {'debug' | 'info' | 'warn' | 'error'} level
   * @param {string} component
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  write(level, component, message, details = {}) {
    const entry = DiagnosticLogEntrySchema.parse({
      timestamp: this.now().toISOString(),
      level,
      component,
      message,
      details,
    });
    const line = `${JSON.stringify(entry)}\n`;
    const settings = this.settings();
    const currentBytes = existsSync(this.path) ? lstatSync(this.path).size : 0;
    if (
      currentBytes > 0 &&
      currentBytes + Buffer.byteLength(line) > settings.diagnosticLogMaximumBytes
    ) {
      rotate(this.path, settings.diagnosticLogFiles);
    }
    appendFileSync(this.path, line, {
      encoding: 'utf8',
      flag: 'a',
      mode: 0o600,
    });
    chmodSync(this.path, 0o600);
    return entry;
  }

  /**
   * @param {number} [limit]
   */
  read(limit = 100) {
    const parsedLimit = Math.min(Math.max(Math.trunc(limit), 1), 10_000);
    const settings = this.settings();
    const paths = [];
    for (let index = settings.diagnosticLogFiles - 1; index >= 1; index -= 1) {
      paths.push(`${this.path}.${String(index)}`);
    }
    paths.push(this.path);

    const entries = [];
    for (const path of paths) {
      if (!existsSync(path)) {
        continue;
      }
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (line.trim() === '') {
          continue;
        }
        try {
          const parsed = DiagnosticLogEntrySchema.safeParse(JSON.parse(line));
          if (parsed.success) {
            entries.push(parsed.data);
          }
        } catch {
          // A partial final line after a crash is not a reason to hide older logs.
        }
      }
    }
    return entries.slice(-parsedLimit);
  }
}

/**
 * @param {string} path
 */
function validateExistingLog(path) {
  if (!existsSync(path)) {
    return;
  }
  const information = lstatSync(path);
  if (!information.isFile() || information.isSymbolicLink()) {
    throw new Error(`Unsafe Portreeve diagnostic log path: ${path}`);
  }
  if (typeof process.getuid === 'function' && information.uid !== process.getuid()) {
    throw new Error(`Portreeve diagnostic log has another owner: ${path}`);
  }
  if ((information.mode & 0o077) !== 0) {
    throw new Error(`Portreeve diagnostic log is not private: ${path}`);
  }
}

/**
 * @param {string} path
 * @param {number} fileCount
 */
function rotate(path, fileCount) {
  const archives = Math.max(fileCount - 1, 0);
  if (archives === 0) {
    rmSync(path, { force: true });
    return;
  }
  rmSync(`${path}.${String(archives)}`, { force: true });
  for (let index = archives - 1; index >= 1; index -= 1) {
    const source = `${path}.${String(index)}`;
    if (existsSync(source)) {
      renameSync(source, `${path}.${String(index + 1)}`);
    }
  }
  if (existsSync(path)) {
    renameSync(path, `${path}.1`);
  }
}
