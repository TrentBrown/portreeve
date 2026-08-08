// @ts-check

/**
 * @param {Date} date
 */
export function toTimestamp(date) {
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('A valid Date is required');
  }
  return date.toISOString();
}

/**
 * @param {string} timestamp
 * @param {Date} now
 */
export function hasExpired(timestamp, now) {
  return Date.parse(timestamp) <= now.getTime();
}

/**
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
export function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
