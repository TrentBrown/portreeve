// @ts-check

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

export const RELEASE_TARGETS = Object.freeze([
  Object.freeze({
    bunTarget: 'bun-darwin-arm64',
    operatingSystem: 'macos',
    architecture: 'arm64',
  }),
  Object.freeze({
    bunTarget: 'bun-darwin-x64-baseline',
    operatingSystem: 'macos',
    architecture: 'x64',
  }),
  Object.freeze({
    bunTarget: 'bun-linux-arm64',
    operatingSystem: 'linux',
    architecture: 'arm64',
  }),
  Object.freeze({
    bunTarget: 'bun-linux-x64-baseline',
    operatingSystem: 'linux',
    architecture: 'x64',
  }),
]);

/**
 * @param {string} version
 * @param {{operatingSystem: string, architecture: string}} target
 */
export function artifactName(version, target) {
  return `portreeve-v${version}-${target.operatingSystem}-${target.architecture}`;
}

/**
 * @param {string} path
 */
export async function sha256File(path) {
  const hash = createHash('sha256');
  hash.update(await readFile(path));
  return hash.digest('hex');
}

/**
 * @param {string} path
 */
export async function inspectExecutable(path) {
  const content = await readFile(path);
  if (content.length < 20) {
    throw new Error(`Release artifact is too small: ${path}`);
  }

  if (
    content[0] === 0xcf &&
    content[1] === 0xfa &&
    content[2] === 0xed &&
    content[3] === 0xfe
  ) {
    const cpu = content.readUInt32LE(4);
    const architecture =
      cpu === 0x0100000c ? 'arm64' : cpu === 0x01000007 ? 'x64' : null;
    if (architecture === null) {
      throw new Error(`Unknown Mach-O CPU type ${cpu} in ${path}`);
    }
    return { operatingSystem: 'macos', architecture };
  }

  if (
    content[0] === 0x7f &&
    content[1] === 0x45 &&
    content[2] === 0x4c &&
    content[3] === 0x46
  ) {
    const littleEndian = content[5] === 1;
    if (!littleEndian) {
      throw new Error(`Unsupported big-endian ELF artifact: ${path}`);
    }
    const machine = content.readUInt16LE(18);
    const architecture = machine === 183 ? 'arm64' : machine === 62 ? 'x64' : null;
    if (architecture === null) {
      throw new Error(`Unknown ELF machine ${machine} in ${path}`);
    }
    return { operatingSystem: 'linux', architecture };
  }

  throw new Error(`Unknown executable format: ${path}`);
}

/**
 * @param {{
 *   version: string,
 *   releaseVersion?: string,
 *   releaseBaseUrl: string,
 *   homepageUrl: string,
 *   checksums: Record<string, string>
 * }} options
 */
export function renderHomebrewFormula(options) {
  const base = options.releaseBaseUrl.replace(/\/+$/u, '');
  const releaseVersion = options.releaseVersion ?? options.version;
  /** @type {Record<string, {filename: string, url: string, checksum: string}>} */
  const artifact = Object.fromEntries(
    RELEASE_TARGETS.map((target) => {
      const filename = artifactName(options.version, target);
      const checksum = options.checksums[filename];
      if (checksum === undefined) {
        throw new Error(`Missing Homebrew checksum for ${filename}`);
      }
      return [
        `${target.operatingSystem}-${target.architecture}`,
        {
          filename,
          url: `${base}/v${releaseVersion}/${filename}`,
          checksum,
        },
      ];
    }),
  );
  /** @param {string} key */
  const entry = (key) => {
    const value = artifact[key];
    if (value === undefined) {
      throw new Error(`Missing Homebrew target ${key}`);
    }
    return value;
  };
  const macArm = entry('macos-arm64');
  const macX64 = entry('macos-x64');
  const linuxArm = entry('linux-arm64');
  const linuxX64 = entry('linux-x64');

  return `class Portreeve < Formula
  desc "Local authority for development ports"
  homepage ${rubyString(options.homepageUrl)}
  version ${rubyString(options.version)}

  on_macos do
    if Hardware::CPU.arm?
      url ${rubyString(macArm.url)}, using: :nounzip
      sha256 ${rubyString(macArm.checksum)}
    else
      url ${rubyString(macX64.url)}, using: :nounzip
      sha256 ${rubyString(macX64.checksum)}
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url ${rubyString(linuxArm.url)}, using: :nounzip
      sha256 ${rubyString(linuxArm.checksum)}
    else
      url ${rubyString(linuxX64.url)}, using: :nounzip
      sha256 ${rubyString(linuxX64.checksum)}
    end
  end

  def install
    artifact = Dir["portreeve-v*"].fetch(0)
    bin.install artifact => "portreeve"
  end

  test do
    assert_equal version.to_s, shell_output("#{bin}/portreeve --version").strip
  end
end
`;
}

/**
 * @param {Array<{filename: string, sha256: string}>} artifacts
 */
export function renderChecksumFile(artifacts) {
  return [...artifacts]
    .sort((left, right) => left.filename.localeCompare(right.filename))
    .map(({ filename, sha256 }) => `${sha256}  ${filename}`)
    .join('\n')
    .concat('\n');
}

/** @param {string} value */
function rubyString(value) {
  return JSON.stringify(value);
}

/**
 * @param {string} path
 * @param {string} expected
 */
export function assertArtifactFilename(path, expected) {
  if (basename(path) !== expected) {
    throw new Error(`Expected artifact ${expected}; received ${basename(path)}`);
  }
}
