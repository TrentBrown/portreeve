// @ts-check

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const supportedTargets = /** @type {const} */ ([
  'bun-darwin-arm64',
  'bun-darwin-x64-baseline',
  'bun-linux-arm64',
  'bun-linux-x64-baseline',
]);

/**
 * @param {string | undefined} value
 * @returns {Bun.Build.CompileTarget | undefined}
 */
function parseTarget(value) {
  if (value === undefined) {
    return undefined;
  }
  if (!supportedTargets.includes(/** @type {never} */ (value))) {
    throw new Error(`Unsupported PORTREEVE_BUILD_TARGET: ${value}`);
  }
  return /** @type {Bun.Build.CompileTarget} */ (value);
}

const target = parseTarget(process.env.PORTREEVE_BUILD_TARGET);
const outfile = resolve('dist', target ? `portreeve-${target}` : 'portreeve');

await mkdir(resolve('dist'), { recursive: true });

const result = await Bun.build({
  entrypoints: [resolve('src/cli/main.js')],
  target: 'bun',
  compile: {
    autoloadBunfig: false,
    autoloadDotenv: false,
    outfile,
    ...(target ? { target } : {}),
  },
  minify: true,
  sourcemap: 'linked',
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exitCode = 1;
} else {
  console.log(outfile);
}
