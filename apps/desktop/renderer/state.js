// @ts-check

/** @param {any} snapshot */
export function availableActions(snapshot) {
  const lifecycle = snapshot.lifecycle;
  if (lifecycle === null) return [];
  if (snapshot.errors.some((/** @type {any} */ { source }) => source === 'lifecycle')) {
    return [];
  }
  if (lifecycle.installation.state === 'absent') return ['installAndStart'];
  if (lifecycle.installation.state === 'invalid' || lifecycle.mode === 'ambiguous') {
    return [];
  }
  const actions = [];
  if (
    lifecycle.installation.state === 'installed' &&
    lifecycle.mode === 'none' &&
    ['inactive', 'unavailable'].includes(lifecycle.supervisor.state)
  ) {
    actions.push('start');
  }
  if (lifecycle.mode === 'supervised') actions.push('stop', 'restart');
  if (lifecycle.mode === 'manual') actions.push('stopManual');
  if (
    lifecycle.installation.state === 'installed' &&
    lifecycle.versions.managed !== null &&
    compareVersions(snapshot.artifact.version, lifecycle.versions.managed) > 0
  ) {
    actions.push('upgrade');
  }
  return actions;
}

/** @param {any} snapshot */
export function canUninstall(snapshot) {
  const lifecycle = snapshot.lifecycle;
  return (
    lifecycle !== null &&
    lifecycle.installation.state === 'installed' &&
    !['manual', 'ambiguous'].includes(lifecycle.mode) &&
    !snapshot.errors.some((/** @type {any} */ { source }) => source === 'lifecycle')
  );
}

/** @param {string} left @param {string} right */
export function compareVersions(left, right) {
  /** @param {string} value */
  const parse = (value) => {
    const [core = '', prerelease] = value.split('-', 2);
    return { numbers: core.split('.').map(Number), prerelease };
  };
  const first = parse(left);
  const second = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (first.numbers[index] ?? 0) - (second.numbers[index] ?? 0);
    if (difference !== 0) return difference;
  }
  if (first.prerelease === second.prerelease) return 0;
  if (first.prerelease === undefined) return 1;
  if (second.prerelease === undefined) return -1;
  return first.prerelease.localeCompare(second.prerelease);
}
