// @ts-check

/**
 * @param {any[]} reference
 * @param {{query?: string, family?: string, safety?: string}} filters
 */
export function filterClientReference(reference, filters = {}) {
  const query = (filters.query ?? '').trim().toLowerCase();
  const family = filters.family ?? 'all';
  const safety = filters.safety ?? 'all';
  return reference.filter((entry) => {
    if (family !== 'all' && entry.family !== family) return false;
    if (safety !== 'all' && entry.safety !== safety) return false;
    if (query === '') return true;
    return referenceSearchText(entry).includes(query);
  });
}

/** @param {any[]} reference */
export function clientReferenceFilters(reference) {
  return {
    families: [...new Set(reference.map(({ family }) => family))].sort(),
    safety: [...new Set(reference.map(({ safety }) => safety))].sort(),
  };
}

/**
 * Group the inert authored AST into the three authored sections. The generated
 * complete reference is rendered separately from structured catalog data.
 * @param {any[]} blocks
 */
export function clientGuideSections(blocks) {
  /** @type {Record<string, any[]>} */
  const sections = {
    'start-here': [],
    'common-workflows': [],
    'troubleshooting-and-safety': [],
  };
  /** @type {string|null} */
  let active = null;
  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 2) {
      active = Object.hasOwn(sections, block.id) ? block.id : null;
    }
    if (active !== null) sections[active]?.push(block);
  }
  return sections;
}

/** @param {any} snapshot */
export function clientInstallationEvidence(snapshot) {
  const lifecycle = snapshot.lifecycle;
  const managedVersion = lifecycle?.versions.managed ?? null;
  const runningVersion = lifecycle?.versions.running ?? null;
  const bundledVersion = snapshot.artifact.version;
  const socket = lifecycle?.socket.state ?? 'unavailable';
  return {
    evidence: snapshot.stale ? 'stale' : 'fresh',
    bundledVersion,
    bundledLocation: snapshot.artifact.bundledLocation,
    managedVersion,
    managedLocation: lifecycle?.installation.managedLocation ?? null,
    runningVersion,
    mode: lifecycle?.mode ?? 'none',
    socket,
    versionMismatch:
      (managedVersion !== null && managedVersion !== bundledVersion) ||
      (runningVersion !== null && runningVersion !== bundledVersion),
    compatibility:
      socket === 'healthy'
        ? 'compatible'
        : socket === 'incompatible'
          ? 'incompatible'
          : socket,
  };
}

/** @param {any} entry */
function referenceSearchText(entry) {
  return [
    entry.path,
    entry.name,
    entry.title,
    entry.description,
    entry.family,
    entry.safety,
    entry.safetyLabel,
    entry.synopsis,
  ]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}
