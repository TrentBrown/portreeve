// @ts-check

import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  StackApplyResponseSchema,
  StackEndActivationResponseSchema,
  StackEndpointSnapshotSchema,
  StackListSchema,
  StackPrepareResponseSchema,
  StackPruneResultSchema,
  StackReconcileActivationResponseSchema,
  StackResolutionSchema,
  StackStatusSchema,
} from '../../../src/protocol/schemas.js';

export const DEFAULT_STACK_PRUNE_AGE_MILLISECONDS = 7 * 86_400_000;

/**
 * @param {{
 *   listStacks(): Promise<unknown>,
 *   getStackStatus(stackId: string): Promise<unknown>,
 *   applyStack(input: {stackRoot: string, definition: unknown}): Promise<unknown>,
 *   prepareStack(stackId: string): Promise<unknown>,
 *   reconcileStackActivation(activationId: string): Promise<unknown>,
 *   endStackActivation(activationId: string): Promise<unknown>,
 *   pruneStacks(input: {olderThanMilliseconds: number, dryRun: boolean}): Promise<unknown>,
 *   resolveStackEndpoints(activationId: string, component: string): Promise<unknown>,
 *   createStackEndpointSnapshot(activationId: string, input: {component: string, gatewayHost: string}): Promise<unknown>
 * }} client
 * @param {{selectDefinitionFile(): Promise<string|null>, documents?: any}} options
 */
export function createStackAdapter(client, options) {
  return Object.freeze({
    async list() {
      const stacks = StackListSchema.parse(await client.listStacks());
      return Promise.all(
        stacks.map(async ({ id }) => {
          const status = StackStatusSchema.parse(await client.getStackStatus(id));
          options.documents?.rememberStack(status.stack);
          const activation = status.activation;
          if (
            activation === null ||
            !['confirmed', 'degraded'].includes(activation.state)
          ) {
            return { ...status, resolutions: [] };
          }
          const componentNames = Object.keys(status.stack.definition.components);
          const resolutions = await Promise.all(
            componentNames.map(async (component) => {
              try {
                return {
                  component,
                  resolution: StackResolutionSchema.parse(
                    await client.resolveStackEndpoints(activation.id, component),
                  ),
                  error: null,
                };
              } catch (error) {
                return {
                  component,
                  resolution: null,
                  error: reduceAdapterError(error),
                };
              }
            }),
          );
          return { ...status, resolutions };
        }),
      );
    },
    async applySelectedDefinition() {
      const filename = await options.selectDefinitionFile();
      if (filename === null) return { cancelled: true, result: null };
      let definition;
      try {
        definition = JSON.parse(await readFile(filename, 'utf8'));
      } catch (error) {
        throw adapterError(
          'invalid_stack_definition_file',
          error instanceof SyntaxError
            ? 'The selected stack definition is not valid JSON.'
            : 'The selected stack definition could not be read.',
        );
      }
      return {
        cancelled: false,
        result: StackApplyResponseSchema.parse(
          await client.applyStack({ stackRoot: dirname(filename), definition }),
        ),
      };
    },
    openStackDocument() {
      return requireDocuments(options).openSelected();
    },
    /** @param {string} stackId */
    openKnownStackDocument(stackId) {
      return requireDocuments(options).openKnown(stackId);
    },
    /** @param {{documentId: string, content: string, conflictToken?: string|null}} request */
    saveStackDocument(request) {
      return requireDocuments(options).save(request);
    },
    /** @param {string} documentId */
    retryStackDocumentApply(documentId) {
      return requireDocuments(options).retryApply(documentId);
    },
    /** @param {string} stackId */
    async prepare(stackId) {
      return StackPrepareResponseSchema.parse(await client.prepareStack(stackId));
    },
    /** @param {string} activationId */
    async reconcile(activationId) {
      return StackReconcileActivationResponseSchema.parse(
        await client.reconcileStackActivation(activationId),
      );
    },
    /** @param {string} activationId */
    async end(activationId) {
      return StackEndActivationResponseSchema.parse(
        await client.endStackActivation(activationId),
      );
    },
    async previewPrune() {
      return StackPruneResultSchema.parse(
        await client.pruneStacks({
          olderThanMilliseconds: DEFAULT_STACK_PRUNE_AGE_MILLISECONDS,
          dryRun: true,
        }),
      );
    },
    async executePrune() {
      return StackPruneResultSchema.parse(
        await client.pruneStacks({
          olderThanMilliseconds: DEFAULT_STACK_PRUNE_AGE_MILLISECONDS,
          dryRun: false,
        }),
      );
    },
    /** @param {string} activationId @param {string} component @param {string} gatewayHost */
    async previewSnapshot(activationId, component, gatewayHost) {
      return StackEndpointSnapshotSchema.parse(
        await client.createStackEndpointSnapshot(activationId, {
          component,
          gatewayHost,
        }),
      );
    },
  });
}

/** @param {{documents?: any}} options */
function requireDocuments(options) {
  if (options.documents === undefined) {
    throw adapterError(
      'stack_document_unavailable',
      'Stack definition editing is unavailable.',
    );
  }
  return options.documents;
}

/** @param {unknown} error */
function reduceAdapterError(error) {
  const hasSafeContract =
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.trim() !== '';
  return {
    code: hasSafeContract ? error.code : 'unavailable',
    message:
      hasSafeContract && error.message.trim() !== ''
        ? error.message
        : 'Stack evidence is unavailable.',
  };
}

/** @param {string} code @param {string} message */
function adapterError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
