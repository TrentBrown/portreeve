// @ts-check

import { InventoryListSchema } from '../../../src/protocol/schemas.js';

/** @param {{listPorts(): Promise<unknown>}} client */
export function createInventoryAdapter(client) {
  return Object.freeze({
    async listPorts() {
      const result = await client.listPorts();
      const parsed = InventoryListSchema.safeParse(result);
      if (!parsed.success) {
        const error = new Error('PortReeve returned unsupported inventory data.');
        Object.assign(error, { code: 'invalid_inventory' });
        throw error;
      }
      return parsed.data;
    },
  });
}
