// @ts-check

import { z } from 'zod';
import {
  IdentifierSchema,
  InventoryEntrySchema,
  PortSchema,
  ReclamationResultSchema,
  ReplacementPolicySchema,
  ServerSettingsResponseSchema,
  StackDefinitionSchema,
  StackPruneResultSchema,
  StackRecordSchema,
  TimestampSchema,
} from '../protocol/schemas.js';

const ReceiptInputSchema = z.object({ receiptId: IdentifierSchema }).strict();
const AgeProposalSchema = z
  .object({
    olderThanMilliseconds: z.number().int().min(0).max(315_576_000_000),
  })
  .strict();
const SettingsUpdatesSchema = ServerSettingsResponseSchema.partial().refine(
  (updates) => Object.keys(updates).length > 0,
  { message: 'At least one setting update is required.' },
);
const StackRevisionSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const ClaimDataSchema = z
  .object({
    id: IdentifierSchema,
    identity: z
      .object({
        project: z.string(),
        workspaceRoot: z.string(),
        service: z.string(),
        component: z.string(),
        endpoint: z.string(),
        transport: z.literal('tcp'),
      })
      .strict(),
    mode: z.enum(['sticky', 'ephemeral']),
    assignedPort: PortSchema.nullable(),
    preferredPort: PortSchema.nullable(),
    exactPort: PortSchema.nullable(),
    assignmentExpiresAt: TimestampSchema.nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    lastUsedAt: TimestampSchema,
  })
  .strict();
const ClaimPruneDataSchema = z
  .object({
    dryRun: z.boolean(),
    candidates: z.array(
      z
        .object({ claim: ClaimDataSchema, reason: z.literal('workspace-missing') })
        .strict(),
    ),
    deletedClaimIds: z.array(IdentifierSchema),
    skipped: z.array(
      z.object({ claimId: IdentifierSchema, reason: z.string().min(1) }).strict(),
    ),
  })
  .strict();
const StackDocumentSchema = z
  .object({
    stackRoot: z.string().min(1),
    stackRootName: z.string().min(1),
    path: z.string().min(1),
    kind: z.enum(['missing', 'regular', 'non-regular', 'oversized']),
    fingerprint: z.string().nullable(),
    definition: StackDefinitionSchema.nullable(),
    revision: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .nullable(),
    issues: z.array(
      z
        .object({
          code: z.string().min(1),
          message: z.string().min(1),
          path: z.array(z.string()),
        })
        .strict(),
    ),
  })
  .strict();
const ValidationSchema = z
  .object({
    valid: z.boolean(),
    definition: StackDefinitionSchema.nullable(),
    revision: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .nullable(),
    issues: z.array(
      z
        .object({
          code: z.string().min(1),
          message: z.string().min(1),
          path: z.array(z.string()),
        })
        .strict(),
    ),
  })
  .strict();
const DocumentEvidenceSchema = StackDocumentSchema.pick({
  path: true,
  kind: true,
  fingerprint: true,
  revision: true,
  issues: true,
});
const StackApplyResultSchema = z.discriminatedUnion('applied', [
  z
    .object({
      saved: z.literal(true),
      applied: z.literal(true),
      path: z.string().min(1),
      fingerprint: StackRevisionSchema,
      revision: StackRevisionSchema,
      changed: z.boolean(),
      stack: StackRecordSchema,
    })
    .strict(),
  z
    .object({
      saved: z.literal(true),
      applied: z.literal(false),
      path: z.string().min(1),
      fingerprint: StackRevisionSchema,
      revision: StackRevisionSchema,
      error: z.object({ code: z.string().min(1), message: z.string().min(1) }).strict(),
    })
    .strict(),
]);
const ReclaimObservedSchema = ReclamationResultSchema.omit({
  operationId: true,
  operation: true,
  dryRun: true,
  signals: true,
}).extend({ inventory: InventoryEntrySchema });
const ClaimReassignProposalSchema = z
  .object({ preferredPort: PortSchema.optional(), exactPort: PortSchema.optional() })
  .refine(
    ({ exactPort, preferredPort }) =>
      exactPort === undefined || preferredPort === undefined,
    { message: 'preferredPort and exactPort are mutually exclusive' },
  );
const ClaimReassignObservedSchema = z
  .object({
    claim: ClaimDataSchema,
    port: PortSchema,
    preferredPort: PortSchema.nullable(),
    exactPort: PortSchema.nullable(),
    inventory: InventoryEntrySchema,
  })
  .strict();
const ClaimDeleteObservedSchema = z
  .object({
    claim: ClaimDataSchema,
    inventory: InventoryEntrySchema.nullable(),
  })
  .strict();
const StackApplyObservedSchema = z
  .object({
    document: DocumentEvidenceSchema,
    stack: z
      .object({
        changed: z.boolean(),
        existing: StackRecordSchema.nullable(),
        revision: StackRevisionSchema,
        definition: StackDefinitionSchema,
      })
      .strict(),
  })
  .strict();

const CONSEQUENCE_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
});
const PREVIEW_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

/**
 * @param {{
 *   client: import('../../packages/client/src/index.js').PortreeveClient,
 *   registerTool: (definition: any) => void,
 *   daemonOperation: (operation: () => Promise<unknown>) => Promise<unknown>
 * }} context
 */
export function registerConsequentialTools({ client, registerTool, daemonOperation }) {
  /** @typedef {{name: string, title: string, description: string, inputSchema: z.ZodType, outputDataSchema: z.ZodType, run: (input: any) => Promise<unknown>}} ToolDefinition */
  /** @param {ToolDefinition} definition */
  const preview = (definition) =>
    registerTool({
      ...definition,
      annotations: PREVIEW_ANNOTATIONS,
    });
  /** @param {ToolDefinition} definition */
  const execute = (definition) =>
    registerTool({
      ...definition,
      annotations: CONSEQUENCE_ANNOTATIONS,
    });

  preview({
    name: 'portreeve_port_reclaim_preview',
    title: 'Preview port reclaim',
    description:
      'Inspect current ownership and listener evidence and issue a five-minute receipt for one normal PortReeve-owned reclaim.',
    inputSchema: z
      .object({ port: PortSchema, policy: ReplacementPolicySchema })
      .strict(),
    outputDataSchema: previewSchema(
      'port.reclaim',
      'port',
      z.object({ policy: ReplacementPolicySchema }).strict(),
      ReclaimObservedSchema,
    ),
    run: ({ port, policy }) =>
      daemonOperation(() => client.previewPortReclaim(port, { policy })),
  });
  execute({
    name: 'portreeve_port_reclaim_execute',
    title: 'Execute port reclaim',
    description:
      'Execute a normal reclaim only when the exact port evidence still matches its receipt. Unsafe any-owner eviction is not available.',
    inputSchema: ReceiptInputSchema.extend({ port: PortSchema }).strict(),
    outputDataSchema: executeSchema(ReclamationResultSchema),
    run: ({ port, receiptId }) =>
      daemonOperation(() => client.executePortReclaim(port, receiptId)),
  });

  preview({
    name: 'portreeve_claim_reassign_preview',
    title: 'Preview claim reassignment',
    description:
      'Choose and inspect a currently idle replacement port for one explicit claim, then issue a five-minute receipt.',
    inputSchema: z
      .object({
        claimId: IdentifierSchema,
        preferredPort: PortSchema.optional(),
        exactPort: PortSchema.optional(),
      })
      .refine(
        ({ exactPort, preferredPort }) =>
          exactPort === undefined || preferredPort === undefined,
        { message: 'preferredPort and exactPort are mutually exclusive' },
      ),
    outputDataSchema: previewSchema(
      'claim.reassign',
      'claim',
      ClaimReassignProposalSchema,
      ClaimReassignObservedSchema,
    ),
    run: ({ claimId, ...options }) =>
      daemonOperation(() => client.previewClaimReassign(claimId, options)),
  });
  execute({
    name: 'portreeve_claim_reassign_execute',
    title: 'Execute claim reassignment',
    description:
      'Reassign one explicit claim only when its idle state and selected-port evidence still match the receipt.',
    inputSchema: ReceiptInputSchema.extend({ claimId: IdentifierSchema }).strict(),
    outputDataSchema: executeSchema(ClaimDataSchema),
    run: ({ claimId, receiptId }) =>
      daemonOperation(() => client.executeClaimReassign(claimId, receiptId)),
  });

  preview({
    name: 'portreeve_claim_delete_preview',
    title: 'Preview claim deletion',
    description:
      'Inspect one explicit idle claim and issue a five-minute deletion receipt.',
    inputSchema: z.object({ claimId: IdentifierSchema }).strict(),
    outputDataSchema: previewSchema(
      'claim.delete',
      'claim',
      z.object({}).strict(),
      ClaimDeleteObservedSchema,
    ),
    run: ({ claimId }) => daemonOperation(() => client.previewClaimDelete(claimId)),
  });
  execute({
    name: 'portreeve_claim_delete_execute',
    title: 'Execute claim deletion',
    description: 'Delete one claim only while its evidence still matches the receipt.',
    inputSchema: ReceiptInputSchema.extend({ claimId: IdentifierSchema }).strict(),
    outputDataSchema: executeSchema(
      z.object({ deleted: z.boolean(), claimId: IdentifierSchema }).strict(),
    ),
    run: ({ claimId, receiptId }) =>
      daemonOperation(() => client.executeClaimDelete(claimId, receiptId)),
  });

  preview({
    name: 'portreeve_claims_prune_preview',
    title: 'Preview stale-claim pruning',
    description:
      'List missing-worktree claim candidates and blockers, then issue a five-minute global prune receipt.',
    inputSchema: ageInputSchema(),
    outputDataSchema: previewSchema(
      'claims.prune',
      'claim-collection',
      AgeProposalSchema,
      ClaimPruneDataSchema,
    ),
    run: (input) => daemonOperation(() => client.previewClaimsPrune(input)),
  });
  execute({
    name: 'portreeve_claims_prune_execute',
    title: 'Execute stale-claim pruning',
    description:
      'Prune only the claim candidate set whose fresh evidence still matches the receipt.',
    inputSchema: ReceiptInputSchema,
    outputDataSchema: executeSchema(ClaimPruneDataSchema),
    run: ({ receiptId }) => daemonOperation(() => client.executeClaimsPrune(receiptId)),
  });

  registerTool({
    name: 'portreeve_stack_document_get',
    title: 'Get canonical stack document',
    description:
      'Read the structured fixed portreeve.stack.json document for one explicit existing stack root. This is not arbitrary filesystem access.',
    inputSchema: z.object({ stackRoot: z.string().min(1) }).strict(),
    outputDataSchema: StackDocumentSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: (/** @type {any} */ { stackRoot }) =>
      daemonOperation(() => client.getStackDocument(stackRoot)),
  });
  registerTool({
    name: 'portreeve_stack_definition_validate',
    title: 'Validate stack definition',
    description:
      'Validate and normalize a typed PortReeve stack definition without reading or writing a file.',
    inputSchema: z.object({ definition: z.unknown() }).strict(),
    outputDataSchema: ValidationSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: (/** @type {any} */ { definition }) =>
      daemonOperation(() => client.validateStackDefinition(definition)),
  });
  preview({
    name: 'portreeve_stack_apply_preview',
    title: 'Preview stack apply',
    description:
      'Validate a typed stack definition, inspect only its fixed canonical document, and issue a fingerprint-bound five-minute receipt.',
    inputSchema: z
      .object({ stackRoot: z.string().min(1), definition: StackDefinitionSchema })
      .strict(),
    outputDataSchema: previewSchema(
      'stack.apply',
      'stack-root',
      z
        .object({ definition: StackDefinitionSchema, revision: StackRevisionSchema })
        .strict(),
      StackApplyObservedSchema,
    ),
    run: (input) => daemonOperation(() => client.previewStackApply(input)),
  });
  execute({
    name: 'portreeve_stack_apply_execute',
    title: 'Execute stack apply',
    description:
      'Write the fixed canonical stack document and apply it only when document and registry evidence still match the receipt.',
    inputSchema: ReceiptInputSchema.extend({ stackRoot: z.string().min(1) }).strict(),
    outputDataSchema: executeSchema(StackApplyResultSchema),
    run: (input) => daemonOperation(() => client.executeStackApply(input)),
  });

  preview({
    name: 'portreeve_stacks_prune_preview',
    title: 'Preview stale-stack pruning',
    description:
      'List stale stack candidates and live blockers, then issue a five-minute global prune receipt.',
    inputSchema: ageInputSchema(),
    outputDataSchema: previewSchema(
      'stacks.prune',
      'stack-collection',
      AgeProposalSchema,
      StackPruneResultSchema,
    ),
    run: (input) => daemonOperation(() => client.previewStacksPrune(input)),
  });
  execute({
    name: 'portreeve_stacks_prune_execute',
    title: 'Execute stale-stack pruning',
    description:
      'Prune only the stack candidate set whose process, Docker, launcher, and filesystem evidence still matches the receipt.',
    inputSchema: ReceiptInputSchema,
    outputDataSchema: executeSchema(StackPruneResultSchema),
    run: ({ receiptId }) => daemonOperation(() => client.executeStacksPrune(receiptId)),
  });

  preview({
    name: 'portreeve_settings_update_preview',
    title: 'Preview settings update',
    description:
      'Validate public runtime-setting changes and issue a five-minute receipt bound to current settings.',
    inputSchema: z.object({ updates: SettingsUpdatesSchema }).strict(),
    outputDataSchema: previewSchema(
      'settings.update',
      'settings',
      z
        .object({
          updates: SettingsUpdatesSchema,
          proposed: ServerSettingsResponseSchema,
        })
        .strict(),
      z.object({ current: ServerSettingsResponseSchema }).strict(),
    ),
    run: ({ updates }) => daemonOperation(() => client.previewConfigUpdate(updates)),
  });
  execute({
    name: 'portreeve_settings_update_execute',
    title: 'Execute settings update',
    description:
      'Apply public runtime settings only while current settings still match the receipt.',
    inputSchema: ReceiptInputSchema,
    outputDataSchema: executeSchema(
      z.object({ settings: ServerSettingsResponseSchema }).strict(),
    ),
    run: ({ receiptId }) =>
      daemonOperation(() => client.executeConfigUpdate(receiptId)),
  });
}

function ageInputSchema() {
  return z
    .object({
      olderThanMilliseconds: z.number().int().min(0).max(315_576_000_000),
    })
    .strict();
}

/** @param {string} action @param {string} targetType @param {z.ZodType} proposalSchema @param {z.ZodType} observedSchema */
function previewSchema(action, targetType, proposalSchema, observedSchema) {
  return z
    .object({
      receiptId: IdentifierSchema,
      action: z.literal(action),
      target: z.object({ type: z.literal(targetType), id: z.string().min(1) }).strict(),
      proposal: proposalSchema,
      observed: observedSchema,
      expiresAt: z.iso.datetime({ offset: true }),
    })
    .strict();
}

/** @param {z.ZodType} resultSchema */
function executeSchema(resultSchema) {
  return z
    .object({
      changed: z.boolean(),
      replayed: z.boolean(),
      result: resultSchema,
    })
    .strict();
}
