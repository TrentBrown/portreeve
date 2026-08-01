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
  const first = parseVersion(left);
  const second = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (first.core[index] ?? 0) - (second.core[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return comparePrerelease(first.prerelease, second.prerelease);
}

/** @param {string} value */
function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?/.exec(value);
  if (match === null) throw new TypeError('Invalid semantic version.');
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] === undefined ? null : match[4].split('.'),
  };
}

/** @param {string[]|null} left @param {string[]|null} right */
function comparePrerelease(left, right) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      return Number(leftPart) < Number(rightPart) ? -1 : 1;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}
