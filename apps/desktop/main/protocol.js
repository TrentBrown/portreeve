// @ts-check

import { readFile, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

/** @type {Readonly<Record<string, string>>} */
const contentTypes = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
});

/** @param {import('electron').Protocol} protocol @param {string} rendererRoot */
export function registerRendererProtocol(protocol, rendererRoot) {
  const canonicalRootPromise = realpath(rendererRoot);
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'portreeve' || request.method !== 'GET') {
      return new Response('Not found', { status: 404 });
    }
    let relativePath;
    try {
      relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch {
      return new Response('Not found', { status: 404 });
    }
    try {
      const canonicalRoot = await canonicalRootPromise;
      const path = await realpath(resolve(canonicalRoot, relativePath || 'index.html'));
      if (!path.startsWith(`${canonicalRoot}${sep}`)) {
        return new Response('Not found', { status: 404 });
      }
      const contentType = contentTypes[extname(path)];
      if (contentType === undefined) {
        return new Response('Not found', { status: 404 });
      }
      return new Response(await readFile(path), {
        status: 200,
        headers: {
          'content-type': contentType,
          'content-security-policy':
            "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}
