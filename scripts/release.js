// @ts-check

import { resolve } from 'node:path';
import { PORTREEVE_VERSION } from '../src/version.js';
import { buildReleaseArtifacts } from './release-build.js';

const releaseBaseUrl = requiredEnvironment('PORTREEVE_RELEASE_BASE_URL');
const homepageUrl = requiredEnvironment('PORTREEVE_HOMEPAGE_URL');
const releaseVersion =
  process.env.PORTREEVE_RELEASE_VERSION?.trim() || PORTREEVE_VERSION;
const destination =
  process.env.PORTREEVE_RELEASE_DIRECTORY?.trim() || resolve('dist', 'release');

const result = await buildReleaseArtifacts({
  destination,
  releaseVersion,
  releaseBaseUrl,
  homepageUrl,
});

console.log(result.releaseDirectory);

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to build release metadata.`);
  }
  return value;
}
