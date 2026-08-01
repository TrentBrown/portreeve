// @ts-check

import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { z } from 'zod';

const ManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    softwareVersion: z.string().min(1),
    artifacts: z.array(
      z
        .object({
          type: z.string(),
          filename: z.string().min(1),
          operatingSystem: z.string().optional(),
          architecture: z.string().optional(),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .passthrough(),
    ),
  })
  .passthrough();

/**
 * Resolve and verify an explicitly provisional CLI input. No PATH lookup or
 * implicit download is permitted.
 *
 * @param {{workspaceRoot: string, platform?: NodeJS.Platform, architecture?: string, overridePath?: string}} options
 */
export async function resolveLocalReleaseCandidate(options) {
  const platform = options.platform ?? process.platform;
  const architecture = options.architecture ?? process.arch;
  const releaseDirectory = resolve(options.workspaceRoot, 'dist', 'release');
  return resolveReleaseCandidate({
    releaseDirectory,
    platform,
    architecture,
    source: 'local-release-candidate',
    ...(options.overridePath ? { overridePath: options.overridePath } : {}),
  });
}

/**
 * @param {{resourcesRoot: string, platform?: NodeJS.Platform, architecture?: string}} options
 */
export function resolveBundledReleaseCandidate(options) {
  return resolveReleaseCandidate({
    releaseDirectory: resolve(options.resourcesRoot, 'portreeve'),
    platform: options.platform ?? process.platform,
    architecture: options.architecture ?? process.arch,
    source: 'local-release-candidate',
  });
}

/**
 * @param {{releaseDirectory: string, platform: NodeJS.Platform, architecture: string, source: 'local-release-candidate'|'published', overridePath?: string}} options
 */
async function resolveReleaseCandidate(options) {
  const operatingSystem = options.platform === 'darwin' ? 'macos' : options.platform;
  const manifest = ManifestSchema.parse(
    JSON.parse(
      await readFile(resolve(options.releaseDirectory, 'manifest.json'), 'utf8'),
    ),
  );
  const artifact = manifest.artifacts.find(
    (entry) =>
      entry.type === 'executable' &&
      entry.operatingSystem === operatingSystem &&
      entry.architecture === options.architecture,
  );
  if (artifact === undefined) {
    throw new Error(
      `No provisional Portreeve artifact exists for ${operatingSystem}/${options.architecture}.`,
    );
  }
  if (basename(artifact.filename) !== artifact.filename) {
    throw new Error('The provisional Portreeve artifact filename is unsafe.');
  }
  const candidate = await realpath(
    options.overridePath ?? resolve(options.releaseDirectory, artifact.filename),
  );
  if (basename(candidate) !== artifact.filename) {
    throw new Error('The provisional Portreeve artifact filename is unexpected.');
  }
  const actual = createHash('sha256')
    .update(await readFile(candidate))
    .digest('hex');
  if (actual !== artifact.sha256) {
    throw new Error('The provisional Portreeve artifact checksum does not match.');
  }
  return Object.freeze({
    source: options.source,
    version: manifest.softwareVersion,
    filename: artifact.filename,
    sha256: artifact.sha256,
    executablePath: candidate,
  });
}
