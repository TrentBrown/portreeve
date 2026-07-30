// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  RELEASE_TARGETS,
  artifactName,
  inspectExecutable,
  renderChecksumFile,
  renderHomebrewFormula,
  sha256File,
} from '../../scripts/release-lib.js';

/** @type {string[]} */
const directories = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('release metadata', () => {
  test('names all supported artifacts and emits stable checksums', async () => {
    expect(RELEASE_TARGETS.map((target) => artifactName('1.2.3', target))).toEqual([
      'portreeve-v1.2.3-macos-arm64',
      'portreeve-v1.2.3-macos-x64',
      'portreeve-v1.2.3-linux-arm64',
      'portreeve-v1.2.3-linux-x64',
    ]);
    const directory = await temporaryDirectory();
    const path = join(directory, 'artifact');
    await writeFile(path, 'portreeve');
    expect(await sha256File(path)).toBe(
      '1ca20a3be8b0490c01bd76974da57075387d54f4cee4610eaa2e9a81f0032dc1',
    );
    expect(
      renderChecksumFile([
        { filename: 'z', sha256: '2' },
        { filename: 'a', sha256: '1' },
      ]),
    ).toBe('1  a\n2  z\n');
  });

  test('identifies each supported executable header', async () => {
    const directory = await temporaryDirectory();
    /** @type {Array<[string, Buffer, {operatingSystem: string, architecture: string}]>} */
    const fixtures = [
      [
        'mac-arm',
        macho(0x0100000c),
        { operatingSystem: 'macos', architecture: 'arm64' },
      ],
      ['mac-x64', macho(0x01000007), { operatingSystem: 'macos', architecture: 'x64' }],
      ['linux-arm', elf(183), { operatingSystem: 'linux', architecture: 'arm64' }],
      ['linux-x64', elf(62), { operatingSystem: 'linux', architecture: 'x64' }],
    ];
    for (const [name, content, expected] of fixtures) {
      const path = join(directory, name);
      await writeFile(path, content);
      expect(await inspectExecutable(path)).toEqual(expected);
    }
  });

  test('renders one checksum-pinned Homebrew formula for all targets', async () => {
    const checksums = Object.fromEntries(
      RELEASE_TARGETS.map((target, index) => [
        artifactName('1.2.3', target),
        String(index).repeat(64),
      ]),
    );
    const formula = renderHomebrewFormula({
      version: '1.2.3',
      releaseBaseUrl: 'https://downloads.example.test/releases/',
      homepageUrl: 'https://example.test/portreeve',
      checksums,
    });
    expect(formula).toContain('class Portreeve < Formula');
    expect(formula).toContain('on_macos do');
    expect(formula).toContain('on_linux do');
    expect(formula).toContain('using: :nounzip');
    for (const target of RELEASE_TARGETS) {
      expect(formula).toContain(artifactName('1.2.3', target));
    }

    const child = Bun.spawn(['ruby', '-c'], {
      stdin: new Blob([formula]),
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [code, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(code, error).toBe(0);
    expect(output).toContain('Syntax OK');
  });
});

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-release-test-'));
  directories.push(directory);
  return directory;
}

/** @param {number} cpu */
function macho(cpu) {
  const content = Buffer.alloc(32);
  content.set([0xcf, 0xfa, 0xed, 0xfe], 0);
  content.writeUInt32LE(cpu, 4);
  return content;
}

/** @param {number} machine */
function elf(machine) {
  const content = Buffer.alloc(32);
  content.set([0x7f, 0x45, 0x4c, 0x46], 0);
  content[5] = 1;
  content.writeUInt16LE(machine, 18);
  return content;
}
