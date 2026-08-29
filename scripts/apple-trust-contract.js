// @ts-check

import assert from 'node:assert/strict';

const SHA256 = /^[a-f0-9]{64}$/u;
const KEY_ID = /^[A-Z0-9]{10}$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;

export const APPLE_TEAM_ID = 'PMWYD5A82A';
export const APPLE_SIGNING_IDENTITY =
  'Developer ID Application: Trent Brown (PMWYD5A82A)';
export const APPLE_NOTARY_KEY_NAME = 'PortReeve Notarization';
export const APPLE_TRUST_STATUS = 'developer-id-notarized';

/**
 * @param {{identity?: unknown, teamId?: unknown, keyId?: unknown,
 *   issuerId?: unknown, keyName?: unknown}} value
 */
export function assertAppleSigningConfiguration(value) {
  const identity = requiredString(value.identity, 'Developer ID identity');
  const teamId = requiredString(value.teamId, 'Apple team ID');
  const keyId = requiredString(value.keyId, 'Notarization key ID');
  const issuerId = requiredString(value.issuerId, 'Notarization issuer ID');
  const keyName = requiredString(value.keyName, 'Notarization key name');
  if (identity !== APPLE_SIGNING_IDENTITY || teamId !== APPLE_TEAM_ID) {
    throw new Error('Apple signing identity does not match PortReeve policy.');
  }
  if (!KEY_ID.test(keyId)) {
    throw new Error('Notarization key ID must contain 10 uppercase letters or digits.');
  }
  if (!UUID.test(issuerId)) {
    throw new Error('Notarization issuer ID must be a UUID.');
  }
  if (keyName !== APPLE_NOTARY_KEY_NAME) {
    throw new Error('Notarization key must be the product-specific PortReeve key.');
  }
  return { identity, teamId, keyId, issuerId, keyName };
}

/**
 * Parse stable non-secret facts from `codesign --display --verbose=4`.
 * @param {string} output
 * @param {{requireRuntime?: boolean}} [options]
 */
export function parseCodesignFacts(output, options = {}) {
  const authority = output.match(/^Authority=(Developer ID Application: .+)$/mu)?.[1];
  const teamId = output.match(/^TeamIdentifier=([A-Z0-9]{10})$/mu)?.[1];
  const timestamp = output.match(/^Timestamp=(.+)$/mu)?.[1];
  const runtime = /flags=.*\(runtime\)/u.test(output);
  assert.ok(authority, 'Developer ID authority is missing.');
  assert.ok(teamId, 'Developer ID team identifier is missing.');
  assert.ok(timestamp, 'Secure timestamp is missing.');
  if (options.requireRuntime ?? true) {
    assert.equal(runtime, true, 'Hardened runtime flag is missing.');
  }
  const facts = {
    identity: authority,
    teamId,
    hardenedRuntime: runtime,
    secureTimestamp: true,
  };
  if (facts.identity !== APPLE_SIGNING_IDENTITY || facts.teamId !== APPLE_TEAM_ID) {
    throw new Error('Signed artifact identity does not match PortReeve policy.');
  }
  return facts;
}

/**
 * Parse the JSON emitted by `xcrun notarytool submit --output-format json`
 * or `xcrun notarytool info --output-format json` without retaining log text.
 * @param {string} output
 * @returns {{requestId: string, status: string}}
 */
export function parseNotarytoolFacts(output) {
  return /** @type {{requestId: string, status: string}} */ (
    parseNotarytoolResponse(output, true)
  );
}

/**
 * A successful asynchronous `notarytool submit` response always includes the
 * request ID, but may omit status until `notarytool info` is called.
 * @param {string} output
 * @returns {{requestId: string, status?: string}}
 */
export function parseNotarytoolSubmissionFacts(output) {
  return parseNotarytoolResponse(output, false);
}

/** @param {string} output @param {boolean} requireStatus */
function parseNotarytoolResponse(output, requireStatus) {
  let value;
  try {
    value = JSON.parse(output);
  } catch {
    throw new Error('Apple notarization response is not valid JSON.');
  }
  const requestId = requiredString(value?.id, 'Apple notarization request ID');
  assertRequestId(requestId);
  if (!requireStatus && value?.status === undefined) return { requestId };
  const status = requiredString(value?.status, 'Apple notarization status');
  if (!['Accepted', 'In Progress', 'Invalid', 'Rejected'].includes(status)) {
    throw new Error('Apple notarization status is unsupported.');
  }
  return { requestId, status };
}

/** @param {{exitCode: number, stdout?: string, stderr?: string}} result */
export function parseStaplerFacts(result) {
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.exitCode !== 0 || !/The validate action worked!/iu.test(output)) {
    throw new Error('Apple stapler validation did not succeed.');
  }
  return { stapled: true, validated: true };
}

/** @param {{exitCode: number, stdout?: string, stderr?: string}} result */
export function parseGatekeeperFacts(result) {
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const accepted = /^(?:.+: )?accepted$/mu.test(output);
  const source = output.match(/^source=(.+)$/mu)?.[1];
  const origin = output.match(/^origin=(.+)$/mu)?.[1];
  if (
    result.exitCode !== 0 ||
    !accepted ||
    source !== 'Notarized Developer ID' ||
    (origin !== undefined && origin !== APPLE_SIGNING_IDENTITY)
  ) {
    throw new Error('Gatekeeper did not accept the notarized PortReeve identity.');
  }
  return {
    accepted: true,
    source,
    ...(origin === undefined ? {} : { origin }),
  };
}

/**
 * Keep platform-command execution injectable and fail closed at a finite deadline.
 * The injected runner must honor the AbortSignal for prompt process cleanup.
 * @template TResult
 * @param {string} command
 * @param {string[]} args
 * @param {{timeoutMs: number, run: (command: string, args: string[], options: {signal: AbortSignal}) => Promise<TResult>}} options
 * @returns {Promise<TResult>}
 */
export async function runBoundedAppleCommand(command, args, options) {
  requiredString(command, 'Apple command');
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new Error('Apple command arguments must be strings.');
  }
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new Error('Apple command timeout must be a positive integer.');
  }
  const controller = new AbortController();
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Apple command exceeded ${options.timeoutMs} ms.`));
    }, options.timeoutMs);
  });
  try {
    return await Promise.race([
      options.run(command, [...args], { signal: controller.signal }),
      timeout,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Run protected work inside a lifecycle that always restores captured state.
 * Configuration is validated before any private material may be prepared.
 *
 * @template TCaptured, TScope, TResult
 * @param {Parameters<typeof assertAppleSigningConfiguration>[0]} configuration
 * @param {{
 *   capture: () => Promise<TCaptured>,
 *   prepare: (configuration: ReturnType<typeof assertAppleSigningConfiguration>, captured: TCaptured) => Promise<TScope>,
 *   cleanup: (scope: TScope|undefined, captured: TCaptured) => Promise<void>,
 * }} lifecycle
 * @param {(scope: TScope, configuration: ReturnType<typeof assertAppleSigningConfiguration>) => Promise<TResult>} action
 */
export async function withAppleCredentialScope(configuration, lifecycle, action) {
  const validated = assertAppleSigningConfiguration(configuration);
  const captured = await lifecycle.capture();
  /** @type {TScope|undefined} */
  let scope;
  /** @type {unknown} */
  let actionError;
  /** @type {TResult|undefined} */
  let result;
  try {
    scope = await lifecycle.prepare(validated, captured);
    result = await action(scope, validated);
  } catch (error) {
    actionError = error;
  }
  try {
    await lifecycle.cleanup(scope, captured);
  } catch (cleanupError) {
    if (actionError !== undefined) {
      throw new AggregateError(
        [actionError, cleanupError],
        'Apple credential action and cleanup both failed.',
        { cause: cleanupError },
      );
    }
    throw cleanupError;
  }
  if (actionError !== undefined) throw actionError;
  return /** @type {TResult} */ (result);
}

/**
 * @typedef {{
 *   schemaVersion: 1,
 *   kind: 'portreeve-notarization-recovery',
 *   candidate: {releaseId: string, sha256: string},
 *   startedAt: string,
 *   deadlineAt: string,
 *   maxUploadAttempts: number,
 *   uploadAttempts: number,
 *   currentRequestId: string|null,
 *   status: 'awaiting-upload'|'awaiting-poll'|'accepted'|'blocked',
 *   history: Array<Record<string, unknown>>,
 * }} NotarizationRecovery
 */

/**
 * @param {{releaseId: string, sha256: string, startedAt: string,
 *   deadlineAt: string, maxUploadAttempts?: number}} options
 * @returns {NotarizationRecovery}
 */
export function createNotarizationRecovery(options) {
  requiredString(options.releaseId, 'Release ID');
  if (!SHA256.test(options.sha256)) throw new Error('Candidate SHA-256 is invalid.');
  assertTimestamp(options.startedAt, 'Notarization start time');
  assertTimestamp(options.deadlineAt, 'Notarization deadline');
  if (Date.parse(options.deadlineAt) <= Date.parse(options.startedAt)) {
    throw new Error('Notarization deadline must be after its start time.');
  }
  const maxUploadAttempts = options.maxUploadAttempts ?? 2;
  if (!Number.isSafeInteger(maxUploadAttempts) || maxUploadAttempts < 1) {
    throw new Error('Notarization upload attempts must be a positive integer.');
  }
  return {
    schemaVersion: 1,
    kind: 'portreeve-notarization-recovery',
    candidate: { releaseId: options.releaseId, sha256: options.sha256 },
    startedAt: options.startedAt,
    deadlineAt: options.deadlineAt,
    maxUploadAttempts,
    uploadAttempts: 0,
    currentRequestId: null,
    status: 'awaiting-upload',
    history: [],
  };
}

/**
 * @param {NotarizationRecovery} recovery
 * @param {{releaseId: string, sha256: string}} candidate
 */
export function assertNotarizationCandidate(recovery, candidate) {
  assertNotarizationRecovery(recovery);
  if (
    candidate.releaseId !== recovery.candidate.releaseId ||
    candidate.sha256 !== recovery.candidate.sha256
  ) {
    throw new Error('Changed candidate bytes require the next unused preview version.');
  }
}

/**
 * @param {NotarizationRecovery} recovery
 * @param {{kind: 'request-created', requestId: string, status?: string, diagnostic?: string}|
 *   {kind: 'upload-no-request', diagnostic: string}|
 *   {kind: 'submission-indeterminate', diagnostic: string}|
 *   {kind: 'poll-indeterminate', requestId: string, diagnostic: string}|
 *   {kind: 'poll', requestId: string, status: string, diagnostic?: string}} observation
 * @param {string} observedAt
 * @returns {NotarizationRecovery}
 */
export function recordNotarizationObservation(recovery, observation, observedAt) {
  assertNotarizationRecovery(recovery);
  assertTimestamp(observedAt, 'Notarization observation time');
  if (['accepted', 'blocked'].includes(recovery.status)) {
    throw new Error('Notarization recovery is already terminal.');
  }
  if (Date.parse(observedAt) > Date.parse(recovery.deadlineAt)) {
    throw new Error('Notarization recovery deadline has expired.');
  }
  const next = structuredClone(recovery);
  if (observation.kind === 'request-created') {
    if (next.currentRequestId !== null) {
      throw new Error('An existing Apple request must be polled, not resubmitted.');
    }
    assertRequestId(observation.requestId);
    if (next.uploadAttempts >= next.maxUploadAttempts) {
      throw new Error('Notarization upload attempt limit is exhausted.');
    }
    next.uploadAttempts += 1;
    next.currentRequestId = observation.requestId;
    if (observation.status === undefined || observation.status === 'In Progress') {
      next.status = 'awaiting-poll';
    } else if (observation.status === 'Accepted') {
      next.status = 'accepted';
    } else if (['Invalid', 'Rejected'].includes(observation.status)) {
      next.status = 'blocked';
    } else {
      throw new Error('Notarization submission status is unsupported.');
    }
  } else if (observation.kind === 'upload-no-request') {
    if (next.currentRequestId !== null) {
      throw new Error('Upload retry is forbidden after Apple creates a request.');
    }
    requiredString(observation.diagnostic, 'No-request diagnostic');
    if (next.uploadAttempts >= next.maxUploadAttempts) {
      throw new Error('Notarization upload attempt limit is exhausted.');
    }
    next.uploadAttempts += 1;
    next.status =
      next.uploadAttempts >= next.maxUploadAttempts ? 'blocked' : 'awaiting-upload';
  } else if (observation.kind === 'submission-indeterminate') {
    if (next.currentRequestId !== null) {
      throw new Error('An existing Apple request must be polled, not resubmitted.');
    }
    requiredString(observation.diagnostic, 'Submission diagnostic');
    if (next.uploadAttempts >= next.maxUploadAttempts) {
      throw new Error('Notarization upload attempt limit is exhausted.');
    }
    next.uploadAttempts += 1;
    next.status = 'blocked';
  } else if (observation.kind === 'poll-indeterminate') {
    assertRequestId(observation.requestId);
    requiredString(observation.diagnostic, 'Polling diagnostic');
    if (
      next.currentRequestId === null ||
      observation.requestId !== next.currentRequestId
    ) {
      throw new Error('Notarization poll does not match the active Apple request.');
    }
    next.status = 'awaiting-poll';
  } else {
    assertRequestId(observation.requestId);
    if (
      next.currentRequestId === null ||
      observation.requestId !== next.currentRequestId
    ) {
      throw new Error('Notarization poll does not match the active Apple request.');
    }
    if (observation.status === 'Accepted') next.status = 'accepted';
    else if (['Invalid', 'Rejected'].includes(observation.status))
      next.status = 'blocked';
    else if (observation.status === 'In Progress') next.status = 'awaiting-poll';
    else throw new Error('Notarization poll status is unsupported.');
  }
  next.history.push({ ...observation, observedAt });
  assertNotarizationRecovery(next);
  return next;
}

/**
 * @param {NotarizationRecovery} recovery
 * @param {string} now
 * @returns {{action: 'accepted'}|{action: 'blocked', reason?: string}|{action: 'poll', requestId: string}|{action: 'submit'}}
 */
export function nextNotarizationAction(recovery, now) {
  assertNotarizationRecovery(recovery);
  assertTimestamp(now, 'Notarization action time');
  if (recovery.status === 'accepted') return { action: 'accepted' };
  if (recovery.status === 'blocked') return { action: 'blocked' };
  if (Date.parse(now) > Date.parse(recovery.deadlineAt)) {
    return { action: 'blocked', reason: 'deadline-expired' };
  }
  if (recovery.currentRequestId !== null) {
    return { action: 'poll', requestId: recovery.currentRequestId };
  }
  if (recovery.uploadAttempts >= recovery.maxUploadAttempts) {
    return { action: 'blocked', reason: 'upload-attempts-exhausted' };
  }
  return { action: 'submit' };
}

/** @param {unknown} value @returns {asserts value is NotarizationRecovery} */
export function assertNotarizationRecovery(value) {
  const candidate = /** @type {Record<string, any>} */ (value);
  if (
    value === null ||
    typeof value !== 'object' ||
    candidate.schemaVersion !== 1 ||
    candidate.kind !== 'portreeve-notarization-recovery' ||
    typeof candidate.candidate?.releaseId !== 'string' ||
    !SHA256.test(String(candidate.candidate?.sha256 ?? '')) ||
    !Number.isSafeInteger(candidate.maxUploadAttempts) ||
    candidate.maxUploadAttempts < 1 ||
    !Number.isSafeInteger(candidate.uploadAttempts) ||
    candidate.uploadAttempts < 0 ||
    candidate.uploadAttempts > candidate.maxUploadAttempts ||
    !['awaiting-upload', 'awaiting-poll', 'accepted', 'blocked'].includes(
      candidate.status,
    ) ||
    !Array.isArray(candidate.history)
  ) {
    throw new Error('Notarization recovery evidence is invalid.');
  }
  assertTimestamp(candidate.startedAt, 'Notarization start time');
  assertTimestamp(candidate.deadlineAt, 'Notarization deadline');
  if (candidate.currentRequestId !== null) assertRequestId(candidate.currentRequestId);
  if (candidate.status === 'awaiting-poll' && candidate.currentRequestId === null) {
    throw new Error('Polling state requires an Apple request ID.');
  }
}

/** @param {unknown} value @param {string} label */
function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

/** @param {unknown} value */
function assertRequestId(value) {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new Error('Apple notarization request ID must be a UUID.');
  }
}

/** @param {unknown} value @param {string} label */
function assertTimestamp(value, label) {
  if (
    typeof value !== 'string' ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error(`${label} must be an ISO timestamp.`);
  }
}
