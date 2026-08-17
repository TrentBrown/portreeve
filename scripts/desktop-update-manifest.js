// @ts-check

import { DesktopUpdateManifestSchema } from '../apps/desktop/shared/schemas.js';

const DEFAULT_DOWNLOAD_PAGE = 'https://github.com/TrentBrown/portreeve/releases';

/**
 * @param {Record<string, any>} record
 * @param {unknown} previous
 * @param {{downloadPageUrl?: string}} [options]
 */
export function createDesktopUpdateManifest(record, previous, options = {}) {
  const manifest = DesktopUpdateManifestSchema.parse(previous);
  if (record.stages.at(-1)?.name !== 'desktop-trust-verified') {
    throw new Error(
      'Desktop update metadata requires completed Desktop trust verification.',
    );
  }
  const dmgs = Object.fromEntries(
    record.artifacts
      .filter(
        (/** @type {Record<string, any>} */ artifact) =>
          artifact.type === 'desktop-dmg',
      )
      .map((/** @type {Record<string, any>} */ artifact) => [
        artifact.architecture,
        artifact,
      ]),
  );
  if (dmgs.arm64 === undefined || dmgs.x64 === undefined) {
    throw new Error('Desktop update metadata requires both recorded DMGs.');
  }
  const release = {
    releaseVersion: record.releaseVersion,
    desktopVersion: record.versions.desktop,
    maturity: record.policy.maturity,
    channel: record.policy.channel,
    desktopTrust: record.policy.desktopTrust,
    downloadPageUrl: options.downloadPageUrl ?? DEFAULT_DOWNLOAD_PAGE,
    artifacts: {
      arm64: { filename: dmgs.arm64.filename, sha256: dmgs.arm64.sha256 },
      x64: { filename: dmgs.x64.filename, sha256: dmgs.x64.sha256 },
    },
  };
  return DesktopUpdateManifestSchema.parse({
    schemaVersion: 2,
    releases: [
      ...manifest.releases.filter(({ channel }) => channel !== release.channel),
      release,
    ].sort((left, right) => left.channel.localeCompare(right.channel)),
  });
}

/** @param {ReturnType<typeof createDesktopUpdateManifest>} manifest */
export function renderDesktopUpdateManifest(manifest) {
  return JSON.stringify(DesktopUpdateManifestSchema.parse(manifest), null, 2).concat(
    '\n',
  );
}
