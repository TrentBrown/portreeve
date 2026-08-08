// @ts-check

/**
 * Read the `code` property of a Node.js system error.
 *
 * @param {unknown} error
 * @returns {unknown}
 */
export function errorCode(error) {
  return error instanceof Error && 'code' in error
    ? /** @type {{code?: unknown}} */ (error).code
    : undefined;
}

/**
 * @param {unknown} error
 * @param {string} code
 */
export function hasErrorCode(error, code) {
  return errorCode(error) === code;
}

/** @param {unknown} error */
export function isMissingFile(error) {
  return hasErrorCode(error, 'ENOENT');
}

/** @param {unknown} error */
export function isMissingPathSegment(error) {
  return isMissingFile(error) || hasErrorCode(error, 'ENOTDIR');
}

/** @param {unknown} error */
export function isAlreadyExists(error) {
  return hasErrorCode(error, 'EEXIST');
}

/**
 * Swallow a missing-file rejection and rethrow every other failure.
 *
 * @param {unknown} error
 */
export function ignoreMissingFile(error) {
  if (!isMissingFile(error)) {
    throw error;
  }
}
