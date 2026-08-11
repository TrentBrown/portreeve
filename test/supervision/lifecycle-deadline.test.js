// @ts-check

import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('keeps a foreground Node caller alive for an intentional lifecycle wait', async () => {
  const moduleUrl = new URL('../../src/supervision/deadline.js', import.meta.url).href;
  const script = `
    import { LifecycleDeadline } from ${JSON.stringify(moduleUrl)};
    const deadline = new LifecycleDeadline({
      timeoutMilliseconds: 1000,
      layer: 'node-runtime-test'
    });
    await deadline.wait(20, 'node-runtime-wait');
    deadline.finish();
    process.stdout.write('wait-complete');
  `;
  const result = await execFileAsync(
    'node',
    ['--input-type=module', '--eval', script],
    {
      encoding: 'utf8',
    },
  );

  expect(result.stdout).toBe('wait-complete');
});
