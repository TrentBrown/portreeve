// @ts-check

import { resolve } from 'node:path';
import { assertSemanticVersion } from './release-record.js';

/**
 * Validate an operator-selected release identity against checked-in component
 * bases. Release outputs may add a prerelease/build suffix, but they may not
 * silently claim a different source version.
 *
 * @param {string} releaseVersion
 * @param {Record<string, string>} sourceVersions
 */
export function assertCoordinatedReleaseVersion(releaseVersion, sourceVersions) {
  assertSemanticVersion(releaseVersion, 'release version');
  const expectedBase = semanticVersionCore(releaseVersion);
  for (const [name, version] of Object.entries(sourceVersions)) {
    assertSemanticVersion(version, `${name} source version`);
    if (version !== expectedBase) {
      throw new Error(
        `Release ${releaseVersion} requires ${name} source version ${expectedBase}; found ${version}.`,
      );
    }
  }
  return expectedBase;
}

/** @param {string} version */
export function semanticVersionCore(version) {
  assertSemanticVersion(version, 'semantic version');
  return version.split(/[+-]/u, 1)[0] ?? version;
}

/**
 * Replace only PortReeve's two version modules while producing immutable
 * release bundles. Ordinary source execution continues to use checked-in base
 * versions.
 *
 * @param {{workspaceRoot: string, releaseVersion: string}} options
 * @returns {Bun.BunPlugin}
 */
export function coordinatedReleaseVersionPlugin(options) {
  const replacements = new Map([
    [
      resolve(options.workspaceRoot, 'src', 'version.js'),
      `// Generated for an immutable PortReeve release build.\n\nexport const PORTREEVE_VERSION = ${JSON.stringify(options.releaseVersion)};\n`,
    ],
    [
      resolve(options.workspaceRoot, 'packages', 'client', 'src', 'version.js'),
      `// Generated for an immutable PortReeve release build.\n\nexport const PORTREEVE_CLIENT_VERSION = ${JSON.stringify(options.releaseVersion)};\n`,
    ],
  ]);
  return {
    name: 'portreeve-coordinated-release-version',
    setup(build) {
      build.onLoad({ filter: /version\.js$/u }, (arguments_) => {
        const contents = replacements.get(resolve(arguments_.path));
        return contents === undefined ? undefined : { contents, loader: 'js' };
      });
    },
  };
}
