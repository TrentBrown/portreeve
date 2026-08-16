// @ts-check

/**
 * @param {string} executablePath
 * @returns {string}
 */
export function foregroundServeCommand(executablePath) {
  const normalized = executablePath.trim();
  if (normalized === '') throw new Error('The bundled CLI location is unavailable.');
  return `${quotePosixArgument(normalized)} serve`;
}

/**
 * @param {any} snapshot
 * @returns {{label: string, detail: string}}
 */
export function quickStartAuthorityPresentation(snapshot) {
  const lifecycle = snapshot?.lifecycle;
  if (lifecycle?.socket?.state !== 'healthy') {
    return {
      label: 'Not running',
      detail: 'Choose the foreground command or open Service setup.',
    };
  }

  const label =
    lifecycle.mode === 'manual'
      ? 'Ready — foreground'
      : lifecycle.mode === 'supervised'
        ? 'Ready — supervised'
        : 'Ready';
  return {
    label,
    detail: 'Skip step 1; the local authority is already reachable.',
  };
}

/** @param {string} value */
function quotePosixArgument(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
