// @ts-check

import { randomBytes } from 'node:crypto';

export const DEFAULT_CUSTODY_MILLISECONDS = 10 * 60 * 1_000;
export const MAX_CUSTODY_MILLISECONDS = 60 * 60 * 1_000;
export const MAX_RENEWAL_DELAY_MILLISECONDS = 10_000;

export class CredentialCustodyError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'CredentialCustodyError';
    this.code = code;
  }
}

/**
 * Process-local authority for lease credentials. Nothing returned from this
 * class's public custody summaries contains a raw credential.
 */
export class CredentialCustody {
  /**
   * @param {{
   *   renewLease: (credential: {leaseId: string, leaseToken: string}) => Promise<{leaseId: string, expiresAt: string}>,
   *   renewActivation: (activationId: string, credentials: Array<{leaseId: string, leaseToken: string}>) => Promise<{leases: Array<{leaseId: string, expiresAt: string}>}>,
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
    this.renewLease = options.renewLease;
    this.renewActivation = options.renewActivation;
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
    /** @type {Map<string, CredentialRecord>} */
    this.credentials = new Map();
    /** @type {Map<string, CustodyGroup>} */
    this.groups = new Map();
    this.closed = false;
  }

  /** @param {{leaseId: string, leaseToken: string, expiresAt: string}} lease */
  holdLease(lease) {
    this.#assertOpen();
    const group = this.#createGroup(`lease:${lease.leaseId}`, 'lease', null);
    try {
      const record = this.#addCredential(group, lease);
      this.#schedule(group);
      return this.#credentialSummary(record, group);
    } catch (error) {
      this.#deleteGroup(group);
      throw error;
    }
  }

  /**
   * @param {string} activationId
   * @param {Array<{leaseId: string, leaseToken: string, expiresAt: string}>} leases
   */
  holdActivation(activationId, leases) {
    this.#assertOpen();
    const group = this.#createGroup(
      `activation:${activationId}`,
      'activation',
      activationId,
    );
    try {
      const held = leases.map((lease) =>
        this.#credentialSummary(this.#addCredential(group, lease), group),
      );
      const summary = {
        activationId,
        credentials: held,
        ...this.#groupSummary(group),
      };
      if (held.length > 0) this.#schedule(group);
      else this.#deleteGroup(group);
      return summary;
    } catch (error) {
      this.#deleteGroup(group);
      throw error;
    }
  }

  /**
   * @param {string} handle
   * @param {{kind?: 'lease' | 'activation', activationId?: string}} [expected]
   */
  get(handle, expected = {}) {
    const record = this.credentials.get(handle);
    if (record === undefined) {
      throw unavailableCredential();
    }
    const group = this.groups.get(record.groupKey);
    if (group === undefined || this.#expireIfNeeded(group)) {
      throw unavailableCredential();
    }
    if (
      (expected.kind !== undefined && group.kind !== expected.kind) ||
      (expected.activationId !== undefined &&
        group.activationId !== expected.activationId)
    ) {
      throw unavailableCredential();
    }
    return { ...record.credential };
  }

  /** @param {string} handle */
  settle(handle) {
    const record = this.credentials.get(handle);
    if (record === undefined) return false;
    const group = this.groups.get(record.groupKey);
    this.credentials.delete(handle);
    if (group !== undefined) {
      group.handles.delete(handle);
      if (group.handles.size === 0) this.#deleteGroup(group);
    }
    return true;
  }

  /**
   * Erase every activation credential whose lease is no longer pending. One
   * endpoint transition can settle sibling leases atomically (for example, a
   * required endpoint failure), so callers reconcile the whole returned
   * activation rather than erasing only the submitted handle.
   * @param {string} activationId
   * @param {Iterable<string>} pendingLeaseIds
   */
  retainActivationLeases(activationId, pendingLeaseIds) {
    const group = this.groups.get(`activation:${activationId}`);
    if (group === undefined) return 0;
    const retained = new Set(pendingLeaseIds);
    for (const handle of [...group.handles]) {
      const record = this.credentials.get(handle);
      if (record === undefined || !retained.has(record.credential.leaseId)) {
        this.settle(handle);
      }
    }
    return group.handles.size;
  }

  /** @param {string} handle */
  isHeld(handle) {
    const record = this.credentials.get(handle);
    if (record === undefined) return false;
    const group = this.groups.get(record.groupKey);
    return group !== undefined && !this.#expireIfNeeded(group);
  }

  /**
   * Set the total custody duration measured from acquisition. Repeating the
   * same request is idempotent; requests cannot shorten custody.
   * @param {string} activationId
   * @param {number} custodyMilliseconds
   */
  extendActivation(activationId, custodyMilliseconds) {
    const group = this.groups.get(`activation:${activationId}`);
    if (group === undefined || this.#expireIfNeeded(group)) {
      throw unavailableCredential();
    }
    const bounded = Math.min(
      Math.max(custodyMilliseconds, this.defaultCustodyMilliseconds),
      this.maximumCustodyMilliseconds,
    );
    const proposed = group.acquiredAt + bounded;
    const changed = proposed > group.custodyExpiresAt;
    if (changed) {
      group.custodyExpiresAt = proposed;
      this.#schedule(group);
    }
    return { changed, activationId, ...this.#groupSummary(group) };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const group of this.groups.values()) {
      if (group.timer !== null) this.cancel(group.timer);
    }
    this.groups.clear();
    this.credentials.clear();
  }

  /** @param {string} key @param {'lease' | 'activation'} kind @param {string | null} activationId */
  #createGroup(key, kind, activationId) {
    const existing = this.groups.get(key);
    if (existing !== undefined && !this.#expireIfNeeded(existing)) return existing;
    const acquiredAt = this.now().getTime();
    /** @type {CustodyGroup} */
    const group = {
      key,
      kind,
      activationId,
      acquiredAt,
      custodyExpiresAt: acquiredAt + this.defaultCustodyMilliseconds,
      maximumCustodyExpiresAt: acquiredAt + this.maximumCustodyMilliseconds,
      handles: new Set(),
      timer: null,
      renewing: false,
    };
    this.groups.set(key, group);
    return group;
  }

  /** @param {CustodyGroup} group @param {{leaseId: string, leaseToken: string, expiresAt: string}} lease */
  #addCredential(group, lease) {
    const handle = this.createHandle();
    if (this.credentials.has(handle)) {
      throw new CredentialCustodyError(
        'credential_handle_collision',
        'PortReeve could not create a unique credential handle.',
      );
    }
    /** @type {CredentialRecord} */
    const record = {
      handle,
      groupKey: group.key,
      credential: { leaseId: lease.leaseId, leaseToken: lease.leaseToken },
      expiresAt: Date.parse(lease.expiresAt),
    };
    this.credentials.set(handle, record);
    group.handles.add(handle);
    return record;
  }

  /** @param {CredentialRecord} record @param {CustodyGroup} group */
  #credentialSummary(record, group) {
    return {
      credentialHandle: record.handle,
      leaseId: record.credential.leaseId,
      leaseExpiresAt: new Date(record.expiresAt).toISOString(),
      ...this.#groupSummary(group),
    };
  }

  /** @param {CustodyGroup} group */
  #groupSummary(group) {
    return {
      custodyExpiresAt: new Date(group.custodyExpiresAt).toISOString(),
      maximumCustodyExpiresAt: new Date(group.maximumCustodyExpiresAt).toISOString(),
      credentialCount: group.handles.size,
    };
  }

  /** @param {CustodyGroup} group */
  #schedule(group) {
    if (this.closed || group.handles.size === 0) return;
    if (group.timer !== null) this.cancel(group.timer);
    const now = this.now().getTime();
    if (now >= group.custodyExpiresAt) {
      this.#deleteGroup(group);
      return;
    }
    const records = [...group.handles]
      .map((handle) => this.credentials.get(handle))
      .filter((record) => record !== undefined);
    if (records.length === 0) {
      this.#deleteGroup(group);
      return;
    }
    const remainingLease = Math.min(...records.map((record) => record.expiresAt - now));
    if (remainingLease <= 0) {
      this.#deleteGroup(group);
      return;
    }
    const delay = Math.max(
      1,
      Math.min(
        this.maximumRenewalDelayMilliseconds,
        Math.floor(remainingLease / 3),
        group.custodyExpiresAt - now,
      ),
    );
    group.timer = this.schedule(() => void this.#renew(group.key), delay);
  }

  /** @param {string} key */
  async #renew(key) {
    const group = this.groups.get(key);
    if (group === undefined || group.renewing || this.#expireIfNeeded(group)) return;
    group.timer = null;
    group.renewing = true;
    const records = [...group.handles]
      .map((handle) => this.credentials.get(handle))
      .filter((record) => record !== undefined);
    try {
      if (group.kind === 'lease') {
        const record = records[0];
        if (record === undefined) return;
        const result = await this.renewLease(record.credential);
        record.expiresAt = Date.parse(result.expiresAt);
      } else {
        const result = await this.renewActivation(
          /** @type {string} */ (group.activationId),
          records.map(({ credential }) => ({ ...credential })),
        );
        const expiries = new Map(
          result.leases.map(({ leaseId, expiresAt }) => [leaseId, expiresAt]),
        );
        for (const record of records) {
          const expiresAt = expiries.get(record.credential.leaseId);
          if (expiresAt !== undefined) record.expiresAt = Date.parse(expiresAt);
        }
      }
    } catch (error) {
      this.onRenewalError(error);
    } finally {
      group.renewing = false;
      if (this.groups.get(key) === group && !this.#expireIfNeeded(group)) {
        this.#schedule(group);
      }
    }
  }

  /** @param {CustodyGroup} group */
  #expireIfNeeded(group) {
    if (this.closed || this.now().getTime() >= group.custodyExpiresAt) {
      this.#deleteGroup(group);
      return true;
    }
    return false;
  }

  /** @param {CustodyGroup} group */
  #deleteGroup(group) {
    if (group.timer !== null) this.cancel(group.timer);
    for (const handle of group.handles) this.credentials.delete(handle);
    group.handles.clear();
    this.groups.delete(group.key);
  }

  #assertOpen() {
    if (this.closed) {
      throw new CredentialCustodyError(
        'credential_custody_closed',
        'PortReeve credential custody is closed.',
      );
    }
  }
}

function unavailableCredential() {
  return new CredentialCustodyError(
    'credential_unavailable',
    'The credential handle is unavailable, expired, settled, or belongs to another bridge.',
  );
}

/** @typedef {{handle: string, groupKey: string, credential: {leaseId: string, leaseToken: string}, expiresAt: number}} CredentialRecord */
/** @typedef {{key: string, kind: 'lease' | 'activation', activationId: string | null, acquiredAt: number, custodyExpiresAt: number, maximumCustodyExpiresAt: number, handles: Set<string>, timer: unknown | null, renewing: boolean}} CustodyGroup */
