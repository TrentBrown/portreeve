// @ts-check

import { SemanticVersionSchema } from './schemas.js';

/**
 * @typedef {{
 *   core: [number, number, number],
 *   prerelease: string[] | null
 * }} ParsedVersion
 */

/**
 * Compare semantic versions without adding a runtime dependency.
 *
 * @param {string} left
 * @param {string} right
 * @returns {-1 | 0 | 1}
 */
export function compareSemanticVersions(left, right) {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  const differences = [
    leftVersion.core[0] - rightVersion.core[0],
    leftVersion.core[1] - rightVersion.core[1],
    leftVersion.core[2] - rightVersion.core[2],
  ];
  for (const difference of differences) {
    if (difference !== 0) {
      return difference < 0 ? -1 : 1;
    }
  }
  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
}

/**
 * @param {string} value
 * @returns {ParsedVersion}
 */
function parseVersion(value) {
  const version = SemanticVersionSchema.parse(value);
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?/.exec(version);
  if (match === null) {
    throw new TypeError(`Invalid semantic version: ${version}`);
  }
  const prerelease = match[4] ?? null;
  return {
    core: [
      Number.parseInt(match[1] ?? '', 10),
      Number.parseInt(match[2] ?? '', 10),
      Number.parseInt(match[3] ?? '', 10),
    ],
    prerelease: prerelease === null ? null : prerelease.split('.'),
  };
}

/**
 * @param {string[] | null} left
 * @param {string[] | null} right
 * @returns {-1 | 0 | 1}
 */
function comparePrerelease(left, right) {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }
    if (leftPart === rightPart) {
      continue;
    }
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      return Number(leftPart) < Number(rightPart) ? -1 : 1;
    }
    if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    }
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}
