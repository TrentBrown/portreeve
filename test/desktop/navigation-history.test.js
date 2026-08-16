// @ts-check

import { expect, test } from 'bun:test';
import {
  createNavigationHistory,
  sameNavigationDestination,
} from '../../apps/desktop/renderer/navigation-history.js';

const overview = Object.freeze({ view: 'overview', anchor: null, scrollY: 0 });

test('traverses session locations in both directions', () => {
  const history = createNavigationHistory(overview);
  expect(history.canMove(-1)).toBeFalse();
  expect(history.canMove(1)).toBeFalse();

  history.replaceCurrent({ ...overview, scrollY: 240 });
  history.push({ view: 'quick-start', anchor: null, scrollY: 0 });
  history.push({ view: 'overview', anchor: 'guide-project-integration', scrollY: 900 });

  expect(history.target(-1)).toEqual({
    view: 'quick-start',
    anchor: null,
    scrollY: 0,
  });
  expect(history.move(-1)).toEqual({
    view: 'quick-start',
    anchor: null,
    scrollY: 0,
  });
  expect(history.move(-1)).toEqual({ ...overview, scrollY: 240 });
  expect(history.move(1)).toEqual({
    view: 'quick-start',
    anchor: null,
    scrollY: 0,
  });
});

test('new navigation after Back discards forward history', () => {
  const history = createNavigationHistory(overview);
  history.push({ view: 'overview', anchor: null, scrollY: 0 });
  history.push({ view: 'mcp', anchor: null, scrollY: 0 });
  history.move(-1);

  history.push({ view: 'cli', anchor: null, scrollY: 0 });

  expect(history.current()).toEqual({ view: 'cli', anchor: null, scrollY: 0 });
  expect(history.canMove(1)).toBeFalse();
  expect(history.move(-1)).toEqual({ view: 'overview', anchor: null, scrollY: 0 });
});

test('replaces duplicate destinations without adding history noise', () => {
  const history = createNavigationHistory(overview);
  expect(history.push({ ...overview, scrollY: 320 })).toBeFalse();
  expect(history.current().scrollY).toBe(320);
  expect(history.canMove(-1)).toBeFalse();
  expect(sameNavigationDestination(overview, { ...overview, scrollY: 999 })).toBeTrue();
});

test('rejects invalid locations without corrupting the current entry', () => {
  const history = createNavigationHistory(overview);
  expect(() => history.push({ view: '', anchor: null, scrollY: 0 })).toThrow(
    'Navigation view is required.',
  );
  expect(() =>
    history.replaceCurrent({ view: 'overview', anchor: null, scrollY: -1 }),
  ).toThrow('Navigation scroll position must be nonnegative.');
  expect(history.current()).toEqual(overview);
});
