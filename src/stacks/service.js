// @ts-check

import {
  StackApplyRequestSchema,
  StackListSchema,
  StackRecordSchema,
  negotiateCompatibility,
} from '../protocol/schemas.js';
import { isAbsolute, relative, sep } from 'node:path';
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

  /** @param {unknown} input */
  previewApply(input) {
    const request = StackApplyRequestSchema.parse(input);
    assertCompatible(request.client);
    if (!isAbsolute(request.stackRoot)) {
      throw new RegistryError('invalid_input', 'Stack root must be an absolute path.', {
        stackRoot: request.stackRoot,
        reason: 'invalid_stack_root',
      });
    }
    const normalized = normalizeStackDefinition(request.definition);
    const stacks = this.registry.listStacks();
    const existing =
      stacks.find(
        (stack) =>
          stack.project === normalized.definition.project &&
          stack.stackRoot === request.stackRoot,
      ) ?? null;
    const overlap = stacks.find(
      (stack) =>
        stack.id !== existing?.id && rootsOverlap(stack.stackRoot, request.stackRoot),
    );
    if (overlap !== undefined) {
      throw new RegistryError(
        'conflict',
        `Stack root ${request.stackRoot} overlaps registered stack root ${overlap.stackRoot}.`,
        {
          stackRoot: request.stackRoot,
          conflictingStackId: overlap.id,
          conflictingStackRoot: overlap.stackRoot,
          reason: 'stack_root_overlap',
        },
      );
    }
    const changed =
      existing === null || existing.currentRevision !== normalized.revision;
    const liveActivation =
      existing === null
        ? null
        : this.registry.getLiveStackActivationForStack(existing.id);
    const activeLauncherOperations =
      existing === null ? [] : this.registry.listActiveLauncherOperations(existing.id);
    if (changed && existing !== null && liveActivation !== null) {
      throw new RegistryError(
        'conflict',
        `Stack ${existing.id} has a live activation and cannot change definition.`,
        {
          stackId: existing.id,
          activationId: liveActivation.id,
          reason: 'live_activation',
        },
      );
    }
    if (changed && existing !== null && activeLauncherOperations.length > 0) {
      throw new RegistryError(
        'conflict',
        `Stack ${existing.id} has an active launcher operation and cannot change definition.`,
        {
          stackId: existing.id,
          operationId: activeLauncherOperations[0]?.id,
          reason: 'launcher_operation_active',
        },
      );
    }
    return {
      changed,
      existing,
      revision: normalized.revision,
      definition: normalized.definition,
    };
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

/** @param {string} left @param {string} right */
function rootsOverlap(left, right) {
  return containsPath(left, right) || containsPath(right, left);
}

/** @param {string} root @param {string} candidate */
function containsPath(root, candidate) {
  const child = relative(root, candidate);
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..');
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
