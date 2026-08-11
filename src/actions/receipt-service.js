// @ts-check

import { createHash, randomUUID } from 'node:crypto';
import { canonicalJson } from '../stacks/definition.js';

export const ACTION_RECEIPT_TTL_MILLISECONDS = 5 * 60 * 1_000;

export class ActionReceiptError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ActionReceiptError';
    this.code = code;
    this.details = details;
  }
}

export class ActionReceiptService {
  /** @param {{registry: import('../storage/registry.js').Registry}} options */
  constructor(options) {
    this.registry = options.registry;
  }

  /**
   * @param {{
   *   action: string,
   *   targetType: string,
   *   targetId: string,
   *   evidence: Record<string, unknown>,
   *   idempotencyKey?: string
   * }} input
   * @param {Date} [now]
   */
  preview(input, now = new Date()) {
    const evidenceJson = canonicalJson(input.evidence);
    return this.registry.createActionReceipt(
      {
        id: randomUUID(),
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        evidence: input.evidence,
        evidenceHash: createHash('sha256').update(evidenceJson).digest('hex'),
        expiresAt: new Date(
          now.getTime() + ACTION_RECEIPT_TTL_MILLISECONDS,
        ).toISOString(),
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
      },
      now,
    );
  }

  /**
   * @template {Record<string, unknown>} T
   * @param {{
   *   receiptId: string,
   *   action: string,
   *   targetType: string,
   *   targetId: string,
   *   evidence: Record<string, unknown>
   * }} input
   * @param {() => T} execute
   * @param {Date} [now]
   * @returns {{changed: boolean, replayed: boolean, result: T}}
   */
  execute(input, execute, now = new Date()) {
    const receipt = this.registry.getActionReceipt(input.receiptId);
    if (receipt === null) {
      throw new ActionReceiptError('not_found', 'Action receipt was not found.', {
        receiptId: input.receiptId,
      });
    }
    if (
      receipt.action !== input.action ||
      receipt.targetType !== input.targetType ||
      receipt.targetId !== input.targetId
    ) {
      throw new ActionReceiptError(
        'receipt_mismatch',
        'Action receipt does not match the requested action, target, and evidence.',
        { receiptId: receipt.id },
      );
    }
    if (receipt.state === 'completed') {
      return {
        changed: false,
        replayed: true,
        result: /** @type {T} */ (receipt.result),
      };
    }
    if (receipt.expiresAt <= now.toISOString()) {
      throw new ActionReceiptError('receipt_expired', 'Action receipt has expired.', {
        receiptId: receipt.id,
        expiresAt: receipt.expiresAt,
      });
    }
    const evidenceHash = createHash('sha256')
      .update(canonicalJson(input.evidence))
      .digest('hex');
    if (receipt.evidenceHash !== evidenceHash) {
      throw new ActionReceiptError(
        'receipt_mismatch',
        'Action receipt evidence is stale or does not match.',
        { receiptId: receipt.id },
      );
    }
    const claimed = this.registry.claimActionReceiptExecution(receipt.id, now);
    if (claimed.state === 'completed') {
      return {
        changed: false,
        replayed: true,
        result: /** @type {T} */ (claimed.result),
      };
    }
    try {
      const result = execute();
      const completed = this.registry.completeActionReceipt(receipt.id, result, now);
      return {
        changed: true,
        replayed: false,
        result: /** @type {T} */ (completed.result),
      };
    } catch (error) {
      this.registry.resetActionReceiptExecution(receipt.id);
      throw error;
    }
  }
}
