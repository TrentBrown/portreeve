// @ts-check

/**
 * Background work has no caller to reject into, so its failures are reported
 * instead of being discarded.
 *
 * @param {string} scope
 * @param {unknown} error
 */
export function reportBackgroundFailure(scope, error) {
  console.error(
    `[portreeve-desktop] ${scope} failed:`,
    error instanceof Error ? error.message : String(error),
  );
}
