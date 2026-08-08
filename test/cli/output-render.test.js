// @ts-check

import { expect, test } from 'bun:test';
import { renderOutput } from '../../src/cli/output/render.js';
import { captureOutput, parseRenderedJson } from '../fixtures/cli-runtime.js';

test('renders one versioned JSON document instead of human lines', async () => {
  const { lines } = await captureOutput(async () => {
    renderOutput(true, 'settings', { gracefulShutdownMilliseconds: 900 }, [
      'human line',
    ]);
  });

  expect(parseRenderedJson(lines)).toEqual({
    version: 1,
    settings: { gracefulShutdownMilliseconds: 900 },
  });
});

test('renders human lines verbatim and emits nothing for empty output', async () => {
  const rendered = await captureOutput(async () => {
    renderOutput(false, 'settings', { ignored: true }, ['first', 'second']);
  });
  expect(rendered.lines).toEqual(['first', 'second']);

  const empty = await captureOutput(async () => {
    renderOutput(false, 'entries', [], []);
  });
  expect(empty.lines).toEqual([]);
});
