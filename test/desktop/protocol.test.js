// @ts-check

import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { registerRendererProtocol } from '../../apps/desktop/main/protocol.js';

test('serves allowlisted local renderer files with a restrictive CSP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-renderer-'));
  const rendererRoot = join(root, 'renderer');
  const brandingRoot = join(root, 'branding');
  await mkdir(rendererRoot);
  await mkdir(brandingRoot);
  await writeFile(join(rendererRoot, 'index.html'), '<p>PortReeve</p>');
  await writeFile(join(rendererRoot, 'private.svg'), '<svg/>');
  await writeFile(join(brandingRoot, 'mark.svg'), '<svg/>');
  await writeFile(join(brandingRoot, 'mark.png'), 'png');
  await writeFile(join(brandingRoot, 'private.html'), '<p>private</p>');
  await writeFile(join(root, 'outside.js'), 'throw new Error("private")');
  await writeFile(join(root, 'outside.svg'), '<svg/>');
  await symlink(join(root, 'outside.js'), join(rendererRoot, 'linked.js'));
  await symlink(join(root, 'outside.svg'), join(brandingRoot, 'linked.svg'));
  /** @type {(request: any) => Promise<Response>} */
  let handler = async () => new Response(null, { status: 500 });
  registerRendererProtocol(
    /** @type {any} */ ({
      /** @param {string} _scheme @param {(request: any) => Promise<Response>} candidate */
      handle(_scheme, candidate) {
        handler = candidate;
      },
    }),
    { rendererRoot, brandingRoot },
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
  const svgResponse = await handler({
    url: 'app://portreeve/branding/mark.svg',
    method: 'GET',
  });
  expect(svgResponse.status).toBe(200);
  expect(svgResponse.headers.get('content-type')).toBe('image/svg+xml');
  const pngResponse = await handler({
    url: 'app://portreeve/branding/mark.png',
    method: 'GET',
  });
  expect(pngResponse.status).toBe(200);
  expect(pngResponse.headers.get('content-type')).toBe('image/png');
  expect(
    (await handler({ url: 'app://portreeve/private.svg', method: 'GET' })).status,
  ).toBe(404);
  expect(
    (
      await handler({
        url: 'app://portreeve/branding/private.html',
        method: 'GET',
      })
    ).status,
  ).toBe(404);
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
  expect(
    (
      await handler({
        url: 'app://portreeve/branding/linked.svg',
        method: 'GET',
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await handler({
        url: 'app://portreeve/branding/%2e%2e%2foutside.svg',
        method: 'GET',
      })
    ).status,
  ).toBe(404);
  expect(
    (await handler({ url: 'app://portreeve/branding/mark.svg', method: 'POST' }))
      .status,
  ).toBe(404);
  expect((await handler({ url: 'app://portreeve/%', method: 'GET' })).status).toBe(404);
  await rm(root, { recursive: true });
});
