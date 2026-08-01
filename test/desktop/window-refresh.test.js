// @ts-check

import { EventEmitter } from 'node:events';
import { expect, test } from 'bun:test';
import { bindWindowRefresh } from '../../apps/desktop/main/window.js';

test('refreshes on focus and pauses polling while hidden or minimized', async () => {
  const events = new EventEmitter();
  let visible = false;
  let minimized = false;
  /** @type {string[]} */
  const calls = [];
  const window = Object.assign(events, {
    isVisible: () => visible,
    isMinimized: () => minimized,
  });
  const coordinator = {
    async refresh() {
      calls.push('refresh');
    },
    start() {
      calls.push('start');
    },
    stop() {
      calls.push('stop');
    },
  };

  bindWindowRefresh(/** @type {any} */ (window), coordinator);
  events.emit('show');
  expect(calls).toEqual([]);

  visible = true;
  events.emit('show');
  events.emit('focus');
  expect(calls).toEqual(['start', 'refresh', 'start']);

  minimized = true;
  events.emit('minimize');
  events.emit('focus');
  expect(calls).toEqual(['start', 'refresh', 'start', 'stop']);

  minimized = false;
  events.emit('restore');
  events.emit('hide');
  expect(calls).toEqual([
    'start',
    'refresh',
    'start',
    'stop',
    'refresh',
    'start',
    'stop',
  ]);
});
