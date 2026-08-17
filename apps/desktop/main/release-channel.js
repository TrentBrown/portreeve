// @ts-check

/** @param {unknown} metadata */
export function resolveDesktopReleaseChannel(metadata) {
  if (
    metadata !== null &&
    typeof metadata === 'object' &&
    'portreeveReleaseChannel' in metadata &&
    metadata.portreeveReleaseChannel === 'stable'
  ) {
    return /** @type {const} */ ('stable');
  }
  return /** @type {const} */ ('preview');
}
