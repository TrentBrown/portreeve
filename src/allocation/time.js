// @ts-check

/**
 * @param {Date} date
 * @param {number} milliseconds
 */
export function addMilliseconds(date, milliseconds) {
  return new Date(date.getTime() + milliseconds);
}
