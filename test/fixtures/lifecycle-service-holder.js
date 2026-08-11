// @ts-check

import { createLifecycleService } from '../../src/supervision/service.js';
import { lifecycleSnapshot } from '../desktop/fixtures.js';

const lockPath = process.argv[2];
if (lockPath === undefined) throw new Error('Lifecycle lock path is required.');

const service = createLifecycleService({
  manager: /** @type {any} */ ({
    paths: { lifecycleLockPath: lockPath },
    status: async () => lifecycleSnapshot(),
    async restart() {
      process.stdout.write('mutating\n');
      await new Promise(() => {});
    },
  }),
  operationTimeoutMilliseconds: 10 * 60 * 1000,
});

await service.restart();
