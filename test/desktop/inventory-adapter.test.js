// @ts-check

import { expect, test } from 'bun:test';
import { createInventoryAdapter } from '../../apps/desktop/main/inventory-adapter.js';
import { inventoryEntry } from './fixtures.js';

test('uses and validates the official client inventory contract', async () => {
  let calls = 0;
  const adapter = createInventoryAdapter({
    async listPorts() {
      calls += 1;
      return [inventoryEntry()];
    },
  });
  expect(await adapter.listPorts()).toHaveLength(1);
  expect(calls).toBe(1);
});

test('rejects inventory outside the public client schema', async () => {
  const adapter = createInventoryAdapter({
    async listPorts() {
      return [{ port: '4173' }];
    },
  });
  await expect(adapter.listPorts()).rejects.toMatchObject({
    code: 'invalid_inventory',
  });
});
