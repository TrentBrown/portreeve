// @ts-check

import { randomBytes } from 'node:crypto';
import {
  DEFAULT_CUSTODY_MILLISECONDS,
  MAX_CUSTODY_MILLISECONDS,
  MAX_RENEWAL_DELAY_MILLISECONDS,
  CredentialCustodyError,
} from './credential-custody.js';

/**
 * Process-local custody for the independent renewable credential returned by
 * the daemon launcher-operation contract. Public summaries never contain the
 * credential itself.
 */
export class LauncherCredentialCustody {
  /**
   * @param {{
   *   renewOperation: (operationId: string, credential: string) => Promise<{operation: import('zod').infer<typeof import('../protocol/schemas.js').LauncherOperationRecordSchema>, renewAfterMilliseconds: number}>,
   *   now?: () => Date,
   *   schedule?: (callback: () => void, delay: number) => unknown,
   *   cancel?: (timer: unknown) => void,
   *   createHandle?: () => string,
   *   defaultCustodyMilliseconds?: number,
   *   maximumCustodyMilliseconds?: number,
   *   maximumRenewalDelayMilliseconds?: number,
   *   onRenewalError?: (error: unknown) => void
   * }} options
   */
  constructor(options) {
    this.renewOperation = options.renewOperation;
    this.now = options.now ?? (() => new Date());
    this.schedule =
      options.schedule ??
      ((callback, delay) => {
        const timer = setTimeout(callback, delay);
        timer.unref?.();
        return timer;
      });
    this.cancel =
      options.cancel ?? ((timer) => clearTimeout(/** @type {any} */ (timer)));
    this.createHandle =
      options.createHandle ?? (() => randomBytes(32).toString('base64url'));
    this.defaultCustodyMilliseconds =
      options.defaultCustodyMilliseconds ?? DEFAULT_CUSTODY_MILLISECONDS;
    this.maximumCustodyMilliseconds =
      options.maximumCustodyMilliseconds ?? MAX_CUSTODY_MILLISECONDS;
    this.maximumRenewalDelayMilliseconds =
      options.maximumRenewalDelayMilliseconds ?? MAX_RENEWAL_DELAY_MILLISECONDS;
    this.onRenewalError = options.onRenewalError ?? (() => {});
    /** @type {Map<string, LauncherCredentialRecord>} */
    this.credentials = new Map();
    this.closed = false;
  }

  /**
   * @param {{
   *   operation: import('zod').infer<typeof import('../protocol/schemas.js').LauncherOperationRecordSchema>,
   *   credential: string,
   *   renewAfterMilliseconds: number
   * }} session
   */
  hold(session) {
    this.#assertOpen();
    const handle = this.createHandle();
    if (this.credentials.has(handle)) {
      throw new CredentialCustodyError(
        'credential_handle_collision',
        'PortReeve could not create a unique credential handle.',
      );
    }
    const acquiredAt = this.now().getTime();
    /** @type {LauncherCredentialRecord} */
    const record = {
      handle,
      operationId: session.operation.id,
      credential: session.credential,
      deadlineAt: parseTimestamp(session.operation.deadlineAt),
      renewAfterMilliseconds: session.renewAfterMilliseconds,
      acquiredAt,
      custodyExpiresAt: acquiredAt + this.defaultCustodyMilliseconds,
      maximumCustodyExpiresAt: acquiredAt + this.maximumCustodyMilliseconds,
      timer: null,
      renewal: null,
    };
    this.credentials.set(handle, record);
    try {
      this.#schedule(record);
      return this.#summary(record);
    } catch (error) {
      this.#delete(record);
      throw error;
    }
  }

  /** @param {string} handle @param {string} operationId */
  get(handle, operationId) {
    const record = this.#available(handle, operationId);
    return { credential: record.credential };
  }

  /**
   * Refresh the daemon heartbeat immediately and optionally extend the total
   * custody duration measured from acquisition.
   * @param {string} handle
   * @param {string} operationId
   * @param {number | undefined} custodyMilliseconds
   */
  async renew(handle, operationId, custodyMilliseconds) {
    const record = this.#available(handle, operationId);
    const custodyChanged =
      custodyMilliseconds === undefined
        ? false
        : this.#extend(record, custodyMilliseconds);
    const response = await this.#renew(record);
    if (
      this.credentials.get(record.handle) !== record ||
      this.#expireIfNeeded(record)
    ) {
      throw unavailableCredential();
    }
    return {
      changed: true,
      custodyChanged,
      operation: response.operation,
      renewAfterMilliseconds: response.renewAfterMilliseconds,
      ...this.#summary(record),
    };
  }

  /** @param {string} handle */
  settle(handle) {
    const record = this.credentials.get(handle);
    if (record === undefined) return false;
    this.#delete(record);
    return true;
  }

  /** @param {string} handle */
  isHeld(handle) {
    const record = this.credentials.get(handle);
    return record !== undefined && !this.#expireIfNeeded(record);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const record of this.credentials.values()) {
      if (record.timer !== null) this.cancel(record.timer);
    }
    this.credentials.clear();
  }

  /** @param {string} handle @param {string} operationId */
  #available(handle, operationId) {
    const record = this.credentials.get(handle);
    if (
      record === undefined ||
      record.operationId !== operationId ||
      this.#expireIfNeeded(record)
    ) {
      throw unavailableCredential();
    }
    return record;
  }

  /** @param {LauncherCredentialRecord} record @param {number} custodyMilliseconds */
  #extend(record, custodyMilliseconds) {
    const bounded = Math.min(
      Math.max(custodyMilliseconds, this.defaultCustodyMilliseconds),
      this.maximumCustodyMilliseconds,
    );
    const proposed = record.acquiredAt + bounded;
    const changed = proposed > record.custodyExpiresAt;
    if (changed) record.custodyExpiresAt = proposed;
    return changed;
  }

  /** @param {LauncherCredentialRecord} record */
  async #renew(record) {
    if (record.renewal !== null) return record.renewal;
    if (this.#expireIfNeeded(record)) throw unavailableCredential();
    if (record.timer !== null) {
      this.cancel(record.timer);
      record.timer = null;
    }
    const renewal = this.renewOperation(record.operationId, record.credential)
      .then((response) => {
        if (this.credentials.get(record.handle) !== record) return response;
        record.deadlineAt = parseTimestamp(response.operation.deadlineAt);
        record.renewAfterMilliseconds = response.renewAfterMilliseconds;
        return response;
      })
      .finally(() => {
        if (this.credentials.get(record.handle) !== record) return;
        record.renewal = null;
        if (!this.#expireIfNeeded(record)) this.#schedule(record);
      });
    record.renewal = renewal;
    return renewal;
  }

  /** @param {LauncherCredentialRecord} record */
  #schedule(record) {
    if (this.closed) return;
    if (record.timer !== null) this.cancel(record.timer);
    const now = this.now().getTime();
    const remaining = record.deadlineAt - now;
    if (remaining <= 0 || now >= record.custodyExpiresAt) {
      this.#delete(record);
      return;
    }
    const delay = Math.max(
      1,
      Math.min(
        this.maximumRenewalDelayMilliseconds,
        record.renewAfterMilliseconds,
        Math.floor(remaining / 3),
        record.custodyExpiresAt - now,
      ),
    );
    record.timer = this.schedule(() => {
      record.timer = null;
      void this.#renew(record).catch((error) => this.onRenewalError(error));
    }, delay);
  }

  /** @param {LauncherCredentialRecord} record */
  #expireIfNeeded(record) {
    const now = this.now().getTime();
    if (this.closed || now >= record.custodyExpiresAt || now >= record.deadlineAt) {
      this.#delete(record);
      return true;
    }
    return false;
  }

  /** @param {LauncherCredentialRecord} record */
  #delete(record) {
    if (record.timer !== null) this.cancel(record.timer);
    record.timer = null;
    this.credentials.delete(record.handle);
  }

  /** @param {LauncherCredentialRecord} record */
  #summary(record) {
    return {
      credentialHandle: record.handle,
      operationId: record.operationId,
      operationDeadlineAt: new Date(record.deadlineAt).toISOString(),
      custodyExpiresAt: new Date(record.custodyExpiresAt).toISOString(),
      maximumCustodyExpiresAt: new Date(record.maximumCustodyExpiresAt).toISOString(),
    };
  }

  #assertOpen() {
    if (this.closed) {
      throw new CredentialCustodyError(
        'credential_custody_closed',
        'PortReeve launcher credential custody is closed.',
      );
    }
  }
}

/** @param {string} value */
function parseTimestamp(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new CredentialCustodyError(
      'credential_deadline_invalid',
      'PortReeve returned an invalid launcher operation deadline.',
    );
  }
  return parsed;
}

function unavailableCredential() {
  return new CredentialCustodyError(
    'credential_unavailable',
    'The credential handle is unavailable, expired, settled, or belongs to another bridge.',
  );
}

/** @typedef {{handle: string, operationId: string, credential: string, deadlineAt: number, renewAfterMilliseconds: number, acquiredAt: number, custodyExpiresAt: number, maximumCustodyExpiresAt: number, timer: unknown | null, renewal: Promise<{operation: import('zod').infer<typeof import('../protocol/schemas.js').LauncherOperationRecordSchema>, renewAfterMilliseconds: number}> | null}} LauncherCredentialRecord */
