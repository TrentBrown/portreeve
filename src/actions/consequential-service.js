// @ts-check

import { ActionReceiptError, ActionReceiptService } from './receipt-service.js';
import { ServerSettingsSchema } from '../domain/settings.js';
import { ConfigSetRequestSchema, negotiateCompatibility } from '../protocol/schemas.js';
import { RegistryError } from '../storage/registry.js';
import {
  StackDocumentError,
  inspectStackDocument,
  validateStackDefinition,
  writeStackDocument,
} from '../stacks/document.js';

const ACTIONS = Object.freeze({
  reclaim: 'port.reclaim',
  claimReassign: 'claim.reassign',
  claimDelete: 'claim.delete',
  claimsPrune: 'claims.prune',
  stackApply: 'stack.apply',
  stacksPrune: 'stacks.prune',
  settingsUpdate: 'settings.update',
});

export class ConsequentialActionService {
  /**
   * @param {{
   *   registry: import('../storage/registry.js').Registry,
   *   reclamationService: import('../reclamation/service.js').ReclamationService,
   *   administrationService: import('../administration/service.js').AdministrationService,
   *   stackDefinitionService: import('../stacks/service.js').StackDefinitionService,
   *   stackAdministrationService: import('../stacks/administration-service.js').StackAdministrationService,
   *   receiptService?: ActionReceiptService,
   *   now?: () => Date
   * }} options
   */
  constructor(options) {
    this.registry = options.registry;
    this.reclamationService = options.reclamationService;
    this.administrationService = options.administrationService;
    this.stackDefinitionService = options.stackDefinitionService;
    this.stackAdministrationService = options.stackAdministrationService;
    this.receiptService =
      options.receiptService ??
      new ActionReceiptService({ registry: options.registry });
    this.now = options.now ?? (() => new Date());
  }

  /** @param {number} port @param {{client: any, policy: string, idempotencyKey?: string}} input */
  async previewPortReclaim(port, input) {
    const proposal = { policy: input.policy };
    return this.#preview(
      ACTIONS.reclaim,
      'port',
      String(port),
      proposal,
      () =>
        this.reclamationService.previewReclaim(port, {
          client: input.client,
          policy: input.policy,
          dryRun: true,
        }),
      input.idempotencyKey,
    );
  }

  /** @param {number} port @param {{client: any, receiptId: string}} input */
  executePortReclaim(port, input) {
    return this.#execute(
      ACTIONS.reclaim,
      'port',
      String(port),
      input.receiptId,
      (proposal) =>
        this.reclamationService.previewReclaim(port, {
          client: input.client,
          policy: proposal.policy,
          dryRun: true,
        }),
      (proposal) =>
        this.reclamationService.reclaim(port, {
          client: input.client,
          policy: proposal.policy,
          dryRun: false,
        }),
    );
  }

  /** @param {string} claimId @param {{client: any, preferredPort?: number, exactPort?: number, idempotencyKey?: string}} input */
  async previewClaimReassign(claimId, input) {
    const proposal = {
      ...(input.preferredPort === undefined
        ? {}
        : { preferredPort: input.preferredPort }),
      ...(input.exactPort === undefined ? {} : { exactPort: input.exactPort }),
    };
    return this.#preview(
      ACTIONS.claimReassign,
      'claim',
      claimId,
      proposal,
      () => this.#observeClaimReassign(claimId, input.client, proposal),
      input.idempotencyKey,
    );
  }

  /** @param {string} claimId @param {{client: any, receiptId: string}} input */
  executeClaimReassign(claimId, input) {
    return this.#execute(
      ACTIONS.claimReassign,
      'claim',
      claimId,
      input.receiptId,
      (proposal) => this.#observeClaimReassign(claimId, input.client, proposal),
      (proposal) =>
        this.administrationService.reassignClaim(claimId, {
          client: input.client,
          ...proposal,
        }),
    );
  }

  /** @param {string} claimId @param {{client: any, idempotencyKey?: string}} input */
  async previewClaimDelete(claimId, input) {
    return this.#preview(
      ACTIONS.claimDelete,
      'claim',
      claimId,
      {},
      () => this.administrationService.previewDeleteClaim(claimId, input),
      input.idempotencyKey,
    );
  }

  /** @param {string} claimId @param {{client: any, receiptId: string}} input */
  executeClaimDelete(claimId, input) {
    return this.#execute(
      ACTIONS.claimDelete,
      'claim',
      claimId,
      input.receiptId,
      () => this.administrationService.previewDeleteClaim(claimId, input),
      async () => ({
        deleted: await this.administrationService.deleteClaim(claimId, input),
        claimId,
      }),
    );
  }

  /** @param {{client: any, olderThanMilliseconds: number, idempotencyKey?: string}} input */
  async previewClaimsPrune(input) {
    const proposal = { olderThanMilliseconds: input.olderThanMilliseconds };
    return this.#preview(
      ACTIONS.claimsPrune,
      'claim-collection',
      'global',
      proposal,
      () =>
        this.administrationService.pruneClaims({
          client: input.client,
          ...proposal,
          dryRun: true,
        }),
      input.idempotencyKey,
    );
  }

  /** @param {{client: any, receiptId: string}} input */
  executeClaimsPrune(input) {
    return this.#execute(
      ACTIONS.claimsPrune,
      'claim-collection',
      'global',
      input.receiptId,
      (proposal) =>
        this.administrationService.pruneClaims({
          client: input.client,
          ...proposal,
          dryRun: true,
        }),
      (proposal) =>
        this.administrationService.pruneClaims({
          client: input.client,
          ...proposal,
          dryRun: false,
        }),
    );
  }

  /** @param {string} stackRoot */
  async getStackDocument(stackRoot) {
    const document = await inspectStackDocument(stackRoot);
    return {
      stackRoot: document.stackRoot,
      stackRootName: document.stackRootName,
      path: document.path,
      kind: document.kind,
      fingerprint: document.fingerprint,
      definition: document.definition,
      revision: document.revision,
      issues: document.issues,
    };
  }

  /** @param {unknown} definition */
  validateStackDefinition(definition) {
    return validateStackDefinition(definition);
  }

  /** @param {{client: any, stackRoot: string, definition: unknown, idempotencyKey?: string}} input */
  async previewStackApply(input) {
    const validated = validateStackDefinition(input.definition);
    if (!validated.valid || validated.definition === null) {
      throw new StackDocumentError(
        'invalid_stack_definition',
        'The stack definition is invalid.',
        { issues: validated.issues },
      );
    }
    const proposal = { definition: validated.definition, revision: validated.revision };
    return this.#preview(
      ACTIONS.stackApply,
      'stack-root',
      input.stackRoot,
      proposal,
      () => this.#observeStackApply(input.stackRoot, input.client, proposal),
      input.idempotencyKey,
    );
  }

  /** @param {{client: any, stackRoot: string, receiptId: string}} input */
  executeStackApply(input) {
    return this.#execute(
      ACTIONS.stackApply,
      'stack-root',
      input.stackRoot,
      input.receiptId,
      (proposal) => this.#observeStackApply(input.stackRoot, input.client, proposal),
      async (proposal, evidence) => {
        const content = `${JSON.stringify(proposal.definition, null, 2)}\n`;
        const document = await writeStackDocument({
          stackRoot: input.stackRoot,
          content,
          expectedFingerprint: /** @type {any} */ (evidence.observed).document
            .fingerprint,
        });
        try {
          const applied = this.stackDefinitionService.apply({
            client: input.client,
            stackRoot: document.stackRoot,
            definition: proposal.definition,
          });
          return {
            saved: true,
            applied: true,
            path: document.path,
            fingerprint: document.fingerprint,
            revision: document.revision,
            ...applied,
          };
        } catch (error) {
          return {
            saved: true,
            applied: false,
            path: document.path,
            fingerprint: document.fingerprint,
            revision: document.revision,
            error: safeError(error),
          };
        }
      },
    );
  }

  /** @param {{client: any, olderThanMilliseconds: number, idempotencyKey?: string}} input */
  async previewStacksPrune(input) {
    const proposal = { olderThanMilliseconds: input.olderThanMilliseconds };
    return this.#preview(
      ACTIONS.stacksPrune,
      'stack-collection',
      'global',
      proposal,
      () =>
        this.stackAdministrationService.prune({
          client: input.client,
          ...proposal,
          dryRun: true,
        }),
      input.idempotencyKey,
    );
  }

  /** @param {{client: any, receiptId: string}} input */
  executeStacksPrune(input) {
    return this.#execute(
      ACTIONS.stacksPrune,
      'stack-collection',
      'global',
      input.receiptId,
      (proposal) =>
        this.stackAdministrationService.prune({
          client: input.client,
          ...proposal,
          dryRun: true,
        }),
      (proposal) =>
        this.stackAdministrationService.prune({
          client: input.client,
          ...proposal,
          dryRun: false,
        }),
    );
  }

  /** @param {{client: any, updates: Record<string, unknown>, idempotencyKey?: string}} input */
  async previewSettingsUpdate(input) {
    const request = ConfigSetRequestSchema.parse(input);
    assertCompatible(request.client);
    const current = this.registry.getSettings();
    const proposed = ServerSettingsSchema.parse({ ...current, ...request.updates });
    const proposal = { updates: request.updates, proposed };
    return this.#preview(
      ACTIONS.settingsUpdate,
      'settings',
      'global',
      proposal,
      async () => ({ current: this.registry.getSettings() }),
      input.idempotencyKey,
    );
  }

  /** @param {{client: any, receiptId: string}} input */
  executeSettingsUpdate(input) {
    assertCompatible(input.client);
    return this.#execute(
      ACTIONS.settingsUpdate,
      'settings',
      'global',
      input.receiptId,
      async () => ({ current: this.registry.getSettings() }),
      (proposal) => ({ settings: this.registry.setSettings(proposal.proposed) }),
    );
  }

  /** @param {string} claimId @param {any} client @param {Record<string, unknown>} proposal */
  async #observeClaimReassign(claimId, client, proposal) {
    const observed = await this.administrationService.previewReassignClaim(claimId, {
      client,
      ...proposal,
    });
    return observed;
  }

  /** @param {string} stackRoot @param {any} client @param {Record<string, any>} proposal */
  async #observeStackApply(stackRoot, client, proposal) {
    const document = await inspectStackDocument(stackRoot);
    const stack = this.stackDefinitionService.previewApply({
      client,
      stackRoot: document.stackRoot,
      definition: proposal.definition,
    });
    return {
      document: {
        path: document.path,
        kind: document.kind,
        fingerprint: document.fingerprint,
        revision: document.revision,
        issues: document.issues,
      },
      stack,
    };
  }

  /** @param {string} action @param {string} targetType @param {string} targetId @param {Record<string, unknown>} proposal @param {() => Promise<Record<string, unknown>>} observe @param {string|undefined} idempotencyKey */
  async #preview(action, targetType, targetId, proposal, observe, idempotencyKey) {
    const observed = await observe();
    const receipt = this.receiptService.preview(
      {
        action,
        targetType,
        targetId,
        evidence: { proposal, observed },
        ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
      },
      this.now(),
    );
    return publicPreview(receipt);
  }

  /** @param {string} action @param {string} targetType @param {string} targetId @param {string} receiptId @param {(proposal: Record<string, any>) => Promise<Record<string, unknown>>} observe @param {(proposal: Record<string, any>, evidence: Record<string, any>) => Promise<Record<string, unknown>>|Record<string, unknown>} execute */
  async #execute(action, targetType, targetId, receiptId, observe, execute) {
    const receipt = this.registry.getActionReceipt(receiptId);
    if (receipt === null) {
      throw new ActionReceiptError('not_found', 'Action receipt was not found.', {
        receiptId,
      });
    }
    if (
      receipt.action !== action ||
      receipt.targetType !== targetType ||
      receipt.targetId !== targetId
    ) {
      throw new ActionReceiptError(
        'receipt_mismatch',
        'Action receipt does not match the requested action and target.',
        { receiptId },
      );
    }
    if (receipt?.state === 'completed') {
      return this.receiptService.executeAsync(
        { receiptId, action, targetType, targetId, evidence: receipt.evidence },
        async () => ({}),
        this.now(),
      );
    }
    const proposal = /** @type {Record<string, any>} */ (receipt.evidence.proposal);
    const evidence = { proposal, observed: await observe(proposal) };
    return this.receiptService.executeAsync(
      { receiptId, action, targetType, targetId, evidence },
      async () => execute(proposal, evidence),
      this.now(),
    );
  }
}

/** @param {import('zod').infer<typeof import('../protocol/schemas.js').ActionReceiptSchema>} receipt */
function publicPreview(receipt) {
  return {
    receiptId: receipt.id,
    action: receipt.action,
    target: { type: receipt.targetType, id: receipt.targetId },
    proposal: receipt.evidence.proposal,
    observed: receipt.evidence.observed,
    expiresAt: receipt.expiresAt,
  };
}

/** @param {unknown} error */
function safeError(error) {
  return {
    code:
      error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'stack_apply_failed',
    message: error instanceof Error ? error.message : 'Stack apply failed.',
  };
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
