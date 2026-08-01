// @ts-check

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  DesktopOpenDownloadResultSchema,
  DesktopUpdateManifestSchema,
  DesktopUpdateStateSchema,
} from '../shared/schemas.js';

export const DESKTOP_UPDATE_MANIFEST_URL =
  'https://raw.githubusercontent.com/TrentBrown/portreeve/main/distribution/desktop-update.json';
export const DESKTOP_DOWNLOAD_PAGE_URL =
  'https://github.com/TrentBrown/portreeve/releases';
export const UPDATE_CHECK_INTERVAL_MILLISECONDS = 24 * 60 * 60 * 1_000;
const UPDATE_REQUEST_TIMEOUT_MILLISECONDS = 5_000;
const MAXIMUM_MANIFEST_BYTES = 16 * 1_024;

export const NOT_CHECKED_UPDATE_STATE = Object.freeze({
  status: /** @type {'not-checked'} */ ('not-checked'),
  checkedAt: null,
  latestVersion: null,
});

/**
 * @param {{
 *   desktopVersion: string,
 *   statePath: string,
 *   fetch?: (input: string|URL|Request, init?: RequestInit) => Promise<Response>,
 *   now?: () => Date,
 *   openExternal: (url: string) => Promise<unknown>,
 *   requestTimeoutMilliseconds?: number,
 * }} options
 */
export function createUpdateAdapter(options) {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const requestTimeoutMilliseconds =
    options.requestTimeoutMilliseconds ?? UPDATE_REQUEST_TIMEOUT_MILLISECONDS;
  let current = DesktopUpdateStateSchema.parse(NOT_CHECKED_UPDATE_STATE);
  /** @type {Promise<ReturnType<typeof DesktopUpdateStateSchema.parse>>|null} */
  let active = null;

  async function check() {
    if (active !== null) return active;
    const operation = performCheck();
    active = operation;
    const clear = () => {
      if (active === operation) active = null;
    };
    void operation.then(clear, clear);
    return operation;
  }

  async function performCheck() {
    const observedAt = now();
    const cached = await readCachedState(options.statePath);
    if (
      cached !== null &&
      cached.checkedAt !== null &&
      isFresh(cached.checkedAt, observedAt)
    ) {
      current = cached;
      return current;
    }

    const checkedAt = observedAt.toISOString();
    let result;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMilliseconds);
      timeout.unref?.();
      try {
        const response = await fetchImplementation(DESKTOP_UPDATE_MANIFEST_URL, {
          method: 'GET',
          headers: { accept: 'application/json' },
          body: null,
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(`Update manifest returned ${response.status}.`);
        const text = await readLimitedText(response, MAXIMUM_MANIFEST_BYTES);
        const manifest = DesktopUpdateManifestSchema.parse(JSON.parse(text));
        result = DesktopUpdateStateSchema.parse({
          status:
            compareSemanticVersions(manifest.desktopVersion, options.desktopVersion) > 0
              ? 'available'
              : 'current',
          checkedAt,
          latestVersion: manifest.desktopVersion,
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      result = DesktopUpdateStateSchema.parse({
        status: 'unavailable',
        checkedAt,
        latestVersion: null,
      });
    }

    current = result;
    await writeCachedState(options.statePath, result).catch(() => undefined);
    return current;
  }

  return Object.freeze({
    check,
    current: () => current,
    async openDownloadPage() {
      if (current.status !== 'available') {
        throw updateError(
          'desktop_update_not_available',
          'No newer Portreeve Desktop release is currently available.',
        );
      }
      await options.openExternal(DESKTOP_DOWNLOAD_PAGE_URL);
      return DesktopOpenDownloadResultSchema.parse({
        schemaVersion: 1,
        opened: true,
      });
    },
  });
}

/** @param {Response} response @param {number} maximumBytes */
async function readLimitedText(response, maximumBytes) {
  const declaredLength = response.headers.get('content-length');
  if (
    declaredLength !== null &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > maximumBytes
  ) {
    throw new Error('Update manifest is too large.');
  }
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > maximumBytes) {
        await reader.cancel('Update manifest is too large.');
        throw new Error('Update manifest is too large.');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

/** @param {string} checkedAt @param {Date} observedAt */
function isFresh(checkedAt, observedAt) {
  return (
    observedAt.getTime() - new Date(checkedAt).getTime() <
    UPDATE_CHECK_INTERVAL_MILLISECONDS
  );
}

/** @param {string} path */
async function readCachedState(path) {
  try {
    return DesktopUpdateStateSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  } catch {
    return null;
  }
}

/** @param {string} path @param {unknown} state */
async function writeCachedState(path, state) {
  const directory = dirname(path);
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

/** @param {string} left @param {string} right */
export function compareSemanticVersions(left, right) {
  const first = parseSemanticVersion(left);
  const second = parseSemanticVersion(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (first.core[index] ?? 0) - (second.core[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return comparePrerelease(first.prerelease, second.prerelease);
}

/** @param {string} value */
function parseSemanticVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+.+)?$/.exec(value);
  if (match === null) throw new TypeError('Invalid semantic version.');
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] === undefined ? null : match[4].split('.'),
  };
}

/** @param {string[]|null} left @param {string[]|null} right */
function comparePrerelease(left, right) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      return Number(leftPart) < Number(rightPart) ? -1 : 1;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

/** @param {string} code @param {string} message */
function updateError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
