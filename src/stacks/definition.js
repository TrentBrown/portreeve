// @ts-check

import { createHash } from 'node:crypto';
import { StackDefinitionSchema } from '../protocol/schemas.js';

/**
 * Normalize and content-address one stack definition.
 *
 * @param {unknown} input
 */
export function normalizeStackDefinition(input) {
  const definition = StackDefinitionSchema.parse(input);
  const definitionJson = canonicalJson(definition);
  const revision = createHash('sha256').update(definitionJson).digest('hex');
  return Object.freeze({ definition, definitionJson, revision });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  return JSON.stringify(sortJson(value));
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}
