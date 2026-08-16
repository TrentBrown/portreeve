// @ts-check

/**
 * @typedef {{view: string, anchor: string|null, scrollY: number}} NavigationLocation
 */

/** @param {NavigationLocation} left @param {NavigationLocation} right */
export function sameNavigationDestination(left, right) {
  return left.view === right.view && left.anchor === right.anchor;
}

/** @param {NavigationLocation} initialLocation */
export function createNavigationHistory(initialLocation) {
  /** @type {NavigationLocation[]} */
  let entries = [normalizeLocation(initialLocation)];
  let index = 0;

  return Object.freeze({
    current() {
      return currentLocation();
    },
    /** @param {-1|1} delta */
    canMove(delta) {
      return index + delta >= 0 && index + delta < entries.length;
    },
    /** @param {-1|1} delta */
    target(delta) {
      if (!this.canMove(delta)) return null;
      return entries[index + delta] ?? null;
    },
    /** @param {NavigationLocation} location */
    replaceCurrent(location) {
      entries[index] = normalizeLocation(location);
      return currentLocation();
    },
    /** @param {NavigationLocation} location */
    push(location) {
      const next = normalizeLocation(location);
      if (sameNavigationDestination(currentLocation(), next)) {
        entries[index] = next;
        return false;
      }
      entries = entries.slice(0, index + 1);
      entries.push(next);
      index += 1;
      return true;
    },
    /** @param {-1|1} delta */
    move(delta) {
      if (!this.canMove(delta)) return null;
      index += delta;
      return currentLocation();
    },
  });

  function currentLocation() {
    const current = entries[index];
    if (current === undefined) throw new Error('Navigation history is empty.');
    return current;
  }
}

/** @param {NavigationLocation} location */
function normalizeLocation(location) {
  if (location.view.trim() === '') throw new TypeError('Navigation view is required.');
  if (!Number.isFinite(location.scrollY) || location.scrollY < 0) {
    throw new TypeError('Navigation scroll position must be nonnegative.');
  }
  return Object.freeze({
    view: location.view,
    anchor: location.anchor === null || location.anchor === '' ? null : location.anchor,
    scrollY: location.scrollY,
  });
}
