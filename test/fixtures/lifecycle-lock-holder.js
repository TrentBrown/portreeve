// @ts-check

import { LifecycleMutationLock } from '../../src/supervision/lock.js';

const path = process.argv[2];
if (path === undefined) throw new Error('Lock path is required.');

const lock = new LifecycleMutationLock({ path });
await lock.acquire('install');
process.stdout.write('ready\n');
await new Promise(() => {});
