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

/** @param {unknown} metadata @param {string} fallback */
export function resolveDesktopReleaseVersion(metadata, fallback) {
  if (
    metadata !== null &&
    typeof metadata === 'object' &&
    'portreeveReleaseVersion' in metadata &&
    typeof metadata.portreeveReleaseVersion === 'string' &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(
      metadata.portreeveReleaseVersion,
    )
  ) {
    return metadata.portreeveReleaseVersion;
  }
  return fallback;
}
