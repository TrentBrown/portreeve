// @ts-check

import {
  LAUNCHER_OPERATION_HISTORY_LIMIT,
  LAUNCHER_OPERATION_RENEW_AFTER_MILLISECONDS,
} from '../protocol/constants.js';
import {
  LauncherOperationBeginRequestSchema,
  LauncherOperationBeginResponseSchema,
  LauncherOperationCompleteRequestSchema,
  LauncherOperationCompleteResponseSchema,
  LauncherOperationListSchema,
  LauncherOperationRecordSchema,
  LauncherOperationRenewRequestSchema,
  LauncherOperationRenewResponseSchema,
  negotiateCompatibility,
} from '../protocol/schemas.js';
import { RegistryError } from '../storage/registry.js';

const CAPABILITY = 'launcher-operations-v1';

export class LauncherOperationService {
  /**
   * @param {{
   *   registry: import('../storage/registry.js').Registry,
   *   now?: () => Date
   * }} options
   */
  constructor({ registry, now = () => new Date() }) {
    this.registry = registry;
    this.now = now;
  }

  /** @param {unknown} input */
  begin(input) {
    const request = LauncherOperationBeginRequestSchema.parse(input);
    assertCompatible(request.client);
    return LauncherOperationBeginResponseSchema.parse({
      ...this.registry.beginLauncherOperation(request, this.now()),
      renewAfterMilliseconds: LAUNCHER_OPERATION_RENEW_AFTER_MILLISECONDS,
    });
  }

  /** @param {string} operationId @param {unknown} input */
  renew(operationId, input) {
    const request = LauncherOperationRenewRequestSchema.parse(input);
    assertCompatible(request.client);
    return LauncherOperationRenewResponseSchema.parse({
      operation: this.registry.renewLauncherOperation(
        operationId,
        request.credential,
        this.now(),
      ),
      renewAfterMilliseconds: LAUNCHER_OPERATION_RENEW_AFTER_MILLISECONDS,
    });
  }

  /** @param {string} operationId @param {unknown} input */
  complete(operationId, input) {
    const request = LauncherOperationCompleteRequestSchema.parse(input);
    assertCompatible(request.client);
    return LauncherOperationCompleteResponseSchema.parse(
      this.registry.completeLauncherOperation(
        operationId,
        request.credential,
        request.completion,
        this.now(),
      ),
    );
  }

  /** @param {string} operationId */
  get(operationId) {
    this.expire();
    const operation = this.registry.getLauncherOperation(operationId);
    if (operation === null) {
      throw new RegistryError(
        'not_found',
        `Launcher operation ${operationId} was not found.`,
        { operationId },
      );
    }
    return LauncherOperationRecordSchema.parse(operation);
  }

  /** @param {string} stackId @param {number} [limit] */
  recent(stackId, limit = LAUNCHER_OPERATION_HISTORY_LIMIT) {
    this.expire();
    if (this.registry.getStack(stackId) === null) {
      throw new RegistryError('not_found', `Stack ${stackId} was not found.`, {
        stackId,
      });
    }
    return LauncherOperationListSchema.parse(
      this.registry.listLauncherOperations(stackId, limit),
    );
  }

  expire() {
    return this.registry.expireLauncherOperations(this.now());
  }
}

/**
 * @param {{protocol: {minimum: number, maximum: number}, requiredCapabilities: string[]}} client
 */
function assertCompatible(client) {
  const result = negotiateCompatibility(client.protocol, [
    ...new Set([...client.requiredCapabilities, CAPABILITY]),
  ]);
  if (!result.compatible) {
    throw new RegistryError(
      'incompatible_protocol',
      'Client and PortReeve launcher-operation requirements do not overlap.',
      result,
    );
  }
}
