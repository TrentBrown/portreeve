// @ts-check

import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { PortreeveClientError } from './client.js';

const MAX_SNAPSHOT_BYTES = 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const REVISION_PATTERN = /^[a-f0-9]{64}$/u;

/**
 * Atomically replace one launcher-owned endpoint snapshot.
 *
 * @param {string} filename
 * @param {unknown} snapshot
 */
export async function writeEndpointSnapshot(filename, snapshot) {
  const parsed = parseEndpointSnapshot(snapshot);
  const target = resolve(filename);
  const directory = dirname(target);
  const temporary = join(
    directory,
    `.${basename(target)}.${process.pid}.${randomUUID()}.tmp`,
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, target);
    return target;
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

/**
 * Read a strict discovery snapshot from an explicit path or
 * PORTREEVE_ENDPOINTS_FILE and optionally reject stale identity.
 *
 * @param {string | undefined} [filename]
 * @param {{
 *   definitionRevision?: string,
 *   generationId?: string,
 *   activationId?: string,
 *   component?: string
 * }} [expected]
 */
export async function readEndpointSnapshot(filename, expected = {}) {
  const selected = filename ?? process.env.PORTREEVE_ENDPOINTS_FILE;
  if (selected === undefined || selected.length === 0) {
    throw snapshotError(
      'No endpoint snapshot path was supplied and PORTREEVE_ENDPOINTS_FILE is unset.',
    );
  }
  let contents;
  try {
    contents = await readFile(resolve(selected));
  } catch (error) {
    throw snapshotError(`Unable to read endpoint snapshot: ${safeMessage(error)}`);
  }
  if (contents.byteLength > MAX_SNAPSHOT_BYTES) {
    throw snapshotError('Endpoint snapshot exceeds the 1 MiB limit.');
  }
  let decoded;
  try {
    decoded = JSON.parse(contents.toString('utf8'));
  } catch (error) {
    throw snapshotError(`Endpoint snapshot is not valid JSON: ${safeMessage(error)}`);
  }
  const snapshot = parseEndpointSnapshot(decoded);
  for (const key of /** @type {const} */ ([
    'definitionRevision',
    'generationId',
    'activationId',
    'component',
  ])) {
    const expectedValue = expected[key];
    if (expectedValue !== undefined && snapshot[key] !== expectedValue) {
      throw snapshotError(
        `Endpoint snapshot ${key} does not match the expected value.`,
        {
          reason: 'stale_snapshot',
          field: key,
          expected: expectedValue,
          actual: snapshot[key],
        },
      );
    }
  }
  return snapshot;
}

/** @param {unknown} input */
export function parseEndpointSnapshot(input) {
  const value = exactObject(input, [
    'schemaVersion',
    'definitionRevision',
    'generationId',
    'activationId',
    'component',
    'own',
    'dependencies',
  ]);
  if (value.schemaVersion !== 1) {
    throw snapshotError('Endpoint snapshot schemaVersion must be 1.');
  }
  const snapshot = {
    schemaVersion: /** @type {const} */ (1),
    definitionRevision: matches(
      value.definitionRevision,
      REVISION_PATTERN,
      'definitionRevision',
    ),
    generationId: matches(value.generationId, UUID_PATTERN, 'generationId'),
    activationId: matches(value.activationId, UUID_PATTERN, 'activationId'),
    component: stackName(value.component, 'component'),
    own: endpointRecord(value.own, 'own'),
    dependencies: endpointRecord(value.dependencies, 'dependencies'),
  };
  return Object.freeze(snapshot);
}

/** @param {unknown} input @param {string} field */
function endpointRecord(input, field) {
  const record = object(input, field);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record).map(([key, endpoint]) => [
        stackName(key, `${field} key`),
        snapshotEndpoint(endpoint, `${field}.${key}`),
      ]),
    ),
  );
}

/** @param {unknown} input @param {string} field */
function snapshotEndpoint(input, field) {
  const value = exactObject(input, ['component', 'endpoint', 'address'], field);
  return Object.freeze({
    component: stackName(value.component, `${field}.component`),
    endpoint: stackName(value.endpoint, `${field}.endpoint`),
    address: address(value.address, `${field}.address`),
  });
}

/** @param {unknown} input @param {string} field */
function address(input, field) {
  const value = exactObject(input, ['transport', 'host', 'port'], field);
  if (value.transport !== 'tcp') {
    throw snapshotError(`${field}.transport must be tcp.`);
  }
  const host = stackName(value.host, `${field}.host`, 253);
  if (/[\s/]/u.test(host)) {
    throw snapshotError(`${field}.host must not contain whitespace or slashes.`);
  }
  const port = value.port;
  if (
    typeof port !== 'number' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    throw snapshotError(`${field}.port must be an integer from 1 through 65535.`);
  }
  return Object.freeze({
    transport: /** @type {const} */ ('tcp'),
    host,
    port,
  });
}

/** @param {unknown} input @param {string} field @param {number} [maximum] */
function stackName(input, field, maximum = 128) {
  if (
    typeof input !== 'string' ||
    input.length < 1 ||
    input.length > maximum ||
    input !== input.trim()
  ) {
    throw snapshotError(`${field} must be a non-empty trimmed string.`);
  }
  return input;
}

/** @param {unknown} input @param {RegExp} pattern @param {string} field */
function matches(input, pattern, field) {
  if (typeof input !== 'string' || !pattern.test(input)) {
    throw snapshotError(`Endpoint snapshot ${field} is invalid.`);
  }
  return input;
}

/** @param {unknown} input @param {string} field */
function object(input, field) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw snapshotError(`${field} must be an object.`);
  }
  return /** @type {Record<string, unknown>} */ (input);
}

/** @param {unknown} input @param {string[]} keys @param {string} [field] */
function exactObject(input, keys, field = 'Endpoint snapshot') {
  const value = object(input, field);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw snapshotError(`${field} has unknown or missing fields.`);
  }
  return value;
}

/** @param {string} message @param {Record<string, unknown>} [details] */
function snapshotError(message, details = {}) {
  return new PortreeveClientError(message, {
    code: 'invalid_input',
    details,
  });
}

/** @param {unknown} error */
function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
