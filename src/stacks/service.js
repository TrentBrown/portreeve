// @ts-check

import {
  StackApplyRequestSchema,
  StackListSchema,
  StackRecordSchema,
  negotiateCompatibility,
} from '../protocol/schemas.js';
import { RegistryError } from '../storage/registry.js';
import { normalizeStackDefinition } from './definition.js';

export class StackDefinitionService {
  /**
   * @param {{registry: import('../storage/registry.js').Registry, now?: () => Date}} options
   */
  constructor({ registry, now = () => new Date() }) {
    this.registry = registry;
    this.now = now;
  }

  /** @param {unknown} input */
  apply(input) {
    const request = StackApplyRequestSchema.parse(input);
    assertCompatible(request.client);
    const normalized = normalizeStackDefinition(request.definition);
    return this.registry.applyStackDefinition(
      {
        project: normalized.definition.project,
        stackRoot: request.stackRoot,
        revision: normalized.revision,
        definitionJson: normalized.definitionJson,
        definition: normalized.definition,
      },
      this.now(),
    );
  }

  /** @param {{project?: string, stackRoot?: string}} [filters] */
  list(filters = {}) {
    return StackListSchema.parse(this.registry.listStacks(filters));
  }

  /** @param {string} stackId */
  get(stackId) {
    const stack = this.registry.getStack(stackId);
    if (stack === null) {
      throw new RegistryError('not_found', `Stack ${stackId} was not found.`, {
        stackId,
      });
    }
    return StackRecordSchema.parse(stack);
  }
}

/** @param {{protocol: {minimum: number, maximum: number}, requiredCapabilities: string[]}} client */
function assertCompatible(client) {
  const result = negotiateCompatibility(client.protocol, client.requiredCapabilities);
  if (!result.compatible) {
    throw new RegistryError(
      'incompatible_protocol',
      'Client and PortReeve protocol requirements do not overlap.',
      result,
    );
  }
}
