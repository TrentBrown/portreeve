// @ts-check

import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { registerRendererProtocol } from '../../apps/desktop/main/protocol.js';

test('serves allowlisted local renderer files with a restrictive CSP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-renderer-'));
  const rendererRoot = join(root, 'renderer');
  await mkdir(rendererRoot);
  await writeFile(join(rendererRoot, 'index.html'), '<p>PortReeve</p>');
  await writeFile(join(root, 'outside.js'), 'throw new Error("private")');
  await symlink(join(root, 'outside.js'), join(rendererRoot, 'linked.js'));
  /** @type {(request: any) => Promise<Response>} */
  let handler = async () => new Response(null, { status: 500 });
  registerRendererProtocol(
    /** @type {any} */ ({
      /** @param {string} _scheme @param {(request: any) => Promise<Response>} candidate */
      handle(_scheme, candidate) {
        handler = candidate;
      },
    }),
    rendererRoot,
  );

  const response = await handler({
    url: 'app://portreeve/index.html',
    method: 'GET',
  });
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('PortReeve');
  expect(response.headers.get('content-security-policy')).toContain(
    "default-src 'none'",
  );
  expect(
    (
      await handler({
        url: 'app://portreeve/%2e%2e%2foutside.js',
        method: 'GET',
      })
    ).status,
  ).toBe(404);
  expect((await handler({ url: 'app://other/index.html', method: 'GET' })).status).toBe(
    404,
  );
  expect(
    (await handler({ url: 'app://portreeve/linked.js', method: 'GET' })).status,
  ).toBe(404);
  expect((await handler({ url: 'app://portreeve/%', method: 'GET' })).status).toBe(404);
  await rm(root, { recursive: true });
});
