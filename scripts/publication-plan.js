// @ts-check

import { basename } from 'node:path';

const DEFAULT_TAP_REPOSITORY = 'TrentBrown/homebrew-portreeve';

/** @param {Record<string, any>} record */
export function createPublicationPlan(record) {
  if (record.stages.at(-1)?.name !== 'distribution-finalized') {
    throw new Error('Publication planning requires finalized distribution evidence.');
  }
  const repository = repositoryName(record.source.repository);
  const formula = requiredArtifact(record, 'homebrew-formula');
  const cask = requiredArtifact(record, 'homebrew-cask');
  const update = requiredArtifact(record, 'desktop-update-metadata');
  const assets = record.artifacts.map(
    (/** @type {Record<string, any>} */ artifact) => ({
      filename: artifact.filename,
      path: artifact.path,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
    }),
  );
  return {
    schemaVersion: 1,
    releaseId: record.releaseId,
    releaseVersion: record.releaseVersion,
    source: { ...record.source },
    policy: { ...record.policy },
    tag: `v${record.releaseVersion}`,
    prerelease: record.policy.channel === 'preview',
    github: {
      repository,
      releaseName: `PortReeve ${record.releaseVersion}`,
      assets,
    },
    homebrew: {
      repository: DEFAULT_TAP_REPOSITORY,
      branch: 'main',
      formula: artifactIdentity(formula),
      cask: artifactIdentity(cask),
    },
    desktopUpdate: {
      repository,
      branch: 'main',
      path: 'distribution/desktop-update.json',
      artifact: artifactIdentity(update),
    },
    npm: { state: 'deferred', published: false },
  };
}

/** @param {ReturnType<typeof createPublicationPlan>} plan */
export function renderPublicationPlan(plan) {
  const assets = plan.github.assets
    .map(
      (/** @type {Record<string, any>} */ artifact) =>
        `- \`${artifact.filename}\` - ${artifact.bytes} bytes - \`${artifact.sha256}\``,
    )
    .join('\n');
  const previewNotice = plan.prerelease
    ? `> **Alpha Preview**
>
> This is alpha software and may make breaking changes. The macOS application is
> ${plan.policy.desktopTrust === 'unsigned' ? '**unsigned** and may require a scoped Open Anyway approval' : `published with trust state \`${plan.policy.desktopTrust}\``}.
> Verify release checksums and follow the [installation guide](https://github.com/${plan.github.repository}/blob/main/docs/installation.md).

`
    : '';
  return `# PortReeve ${plan.releaseVersion} publication plan

${previewNotice}

**Source:** \`${plan.source.commit}\`
**Tag:** \`${plan.tag}\`
**Channel:** ${plan.policy.channel}
**Product maturity:** ${plan.policy.maturity}
**Desktop trust:** ${plan.policy.desktopTrust}
**GitHub release kind:** ${plan.prerelease ? 'prerelease' : 'release'}

## Immutable GitHub assets

${assets}

## Public references

- GitHub repository: \`${plan.github.repository}\`
- Homebrew tap: \`${plan.homebrew.repository}\`
- Formula source: \`${plan.homebrew.formula.filename}\`
- Cask source: \`${plan.homebrew.cask.filename}\`
- Desktop update metadata: \`${plan.desktopUpdate.path}\`
- npm: deferred and not part of this publication

## Approval boundary

Publishing creates or verifies the exact GitHub ${plan.prerelease ? 'prerelease' : 'release'} first. It then opens or recovers deterministic pull requests for the Homebrew tap and channel-aware Desktop metadata, merges them with merge commits only when repository policy permits, and verifies the exact destination bytes. A PR that still needs checks or independent review remains open for recovery. Publication never rebuilds an artifact. The command requires explicit confirmation and binds approval to the SHA-256 of this exact plan.
`;
}

/** @param {Record<string, any>} record @param {string} type */
function requiredArtifact(record, type) {
  const artifact = record.artifacts.find(
    (/** @type {Record<string, any>} */ entry) => entry.type === type,
  );
  if (artifact === undefined) {
    throw new Error(`Publication plan requires artifact type ${type}.`);
  }
  return artifact;
}

/** @param {Record<string, any>} artifact */
function artifactIdentity(artifact) {
  if (basename(artifact.path) !== artifact.filename) {
    throw new Error(`Publication artifact path is invalid: ${artifact.filename}`);
  }
  return {
    filename: artifact.filename,
    path: artifact.path,
    bytes: artifact.bytes,
    sha256: artifact.sha256,
  };
}

/** @param {string} value */
function repositoryName(value) {
  const match = /(?:github\.com[/:])([^/]+\/[^/.]+)(?:\.git)?$/u.exec(value);
  if (match?.[1] === undefined) {
    throw new Error(`Unsupported GitHub source repository: ${value}`);
  }
  return match[1];
}
