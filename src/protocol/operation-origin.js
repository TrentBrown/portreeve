// @ts-check

import { AsyncLocalStorage } from 'node:async_hooks';
import { OperationOriginSchema } from './schemas.js';

const operationOrigin = new AsyncLocalStorage();

/**
 * Attribution is diagnostic context only. It is never consulted for authority,
 * ownership, or target selection.
 *
 * @template T
 * @param {unknown} origin
 * @param {() => T} callback
 * @returns {T}
 */
export function runWithOperationOrigin(origin, callback) {
  const parsed = origin === undefined ? null : OperationOriginSchema.parse(origin);
  return operationOrigin.run(parsed, callback);
}

export function currentOperationOrigin() {
  return operationOrigin.getStore() ?? null;
}
