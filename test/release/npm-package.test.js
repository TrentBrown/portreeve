// @ts-check

import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('npm tarball contains only the public client and works from Node', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-npm-consumer-'));
  try {
    const packed = await run([
      'npm',
      'pack',
      resolve('packages', 'client'),
      '--json',
      '--pack-destination',
      directory,
    ]);
    expect(packed.code, packed.stderr).toBe(0);
    const result = JSON.parse(packed.stdout)[0];
    expect(result.name).toBe('portreeve');
    expect(
      result.files.map((/** @type {{path: string}} */ { path }) => path).sort(),
    ).toEqual([
      'LICENSE',
      'README.md',
      'package.json',
      'src/client.js',
      'src/constants.js',
      'src/discovery.js',
      'src/index.d.ts',
      'src/index.js',
      'src/version.js',
    ]);

    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    const install = await run(
      [
        'npm',
        'install',
        '--offline',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        join(directory, result.filename),
      ],
      directory,
    );
    expect(install.code, install.stderr).toBe(0);
    await writeFile(
      join(directory, 'consumer.mjs'),
      `import { PortreeveClient } from 'portreeve';
const client = new PortreeveClient({ socketPath: '/tmp/portreeve-test.sock' });
process.stdout.write(client.socketPath);
`,
    );
    const consumer = await run(['node', join(directory, 'consumer.mjs')], directory);
    expect(consumer.code, consumer.stderr).toBe(0);
    expect(consumer.stdout).toBe('/tmp/portreeve-test.sock');

    const installedMetadata = JSON.parse(
      await readFile(
        join(directory, 'node_modules', 'portreeve', 'package.json'),
        'utf8',
      ),
    );
    expect(installedMetadata.private).toBeUndefined();
    expect(installedMetadata.version).toBe('0.1.0');
    expect(installedMetadata.license).toBe('MIT');
    expect(installedMetadata.repository).toMatchObject({
      url: 'git+https://github.com/TrentBrown/portreeve.git',
      directory: 'packages/client',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);

/**
 * @param {string[]} command
 * @param {string} [cwd]
 */
async function run(command, cwd) {
  const child = Bun.spawn(command, {
    ...(cwd === undefined ? {} : { cwd }),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr };
}
