// @ts-check

import { expect, test } from 'bun:test';
import { parseLsofFields } from '../../src/inspection/listeners.js';

test('parses every process and listener name from lsof field output', () => {
  expect(
    parseLsofFields(
      [
        'p123',
        'cbun',
        'f10',
        'n*:43100',
        'f11',
        'n[::1]:43100',
        'f12',
        'n*:43101',
        'p456',
        'cnode',
        'f13',
        'n127.0.0.1:43100',
        '',
      ].join('\n'),
    ),
  ).toEqual([
    {
      pid: 123,
      port: 43100,
      command: 'bun',
      names: ['*:43100', '[::1]:43100'],
    },
    {
      pid: 123,
      port: 43101,
      command: 'bun',
      names: ['*:43101'],
    },
    {
      pid: 456,
      port: 43100,
      command: 'node',
      names: ['127.0.0.1:43100'],
    },
  ]);
});
