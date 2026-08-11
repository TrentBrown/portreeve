// @ts-check

/**
 * Stable names for the approved operation-specific MCP surface. Registration
 * and schemas are added in later slices, but every slice consumes this catalog
 * instead of inventing transport-facing names ad hoc.
 */
export const MCP_TOOL_NAMES = Object.freeze([
  'portreeve_health',
  'portreeve_compatibility',
  'portreeve_diagnostics',
  'portreeve_settings_get',
  'portreeve_ports_list',
  'portreeve_port_inspect',
  'portreeve_port_reclaim_preview',
  'portreeve_port_reclaim_execute',
  'portreeve_claims_list',
  'portreeve_claim_get',
  'portreeve_claim_reassign_preview',
  'portreeve_claim_reassign_execute',
  'portreeve_claim_delete_preview',
  'portreeve_claim_delete_execute',
  'portreeve_claims_prune_preview',
  'portreeve_claims_prune_execute',
  'portreeve_lease_acquire',
  'portreeve_lease_confirm',
  'portreeve_lease_abandon',
  'portreeve_run_release',
  'portreeve_stacks_list',
  'portreeve_stack_get',
  'portreeve_stack_document_get',
  'portreeve_stack_definition_validate',
  'portreeve_stack_status',
  'portreeve_stack_prepare',
  'portreeve_stack_apply_preview',
  'portreeve_stack_apply_execute',
  'portreeve_stacks_prune_preview',
  'portreeve_stacks_prune_execute',
  'portreeve_generation_get',
  'portreeve_generations_list',
  'portreeve_activation_get',
  'portreeve_activations_list',
  'portreeve_activation_begin',
  'portreeve_activation_custody_extend',
  'portreeve_activation_resolve',
  'portreeve_activation_confirm_endpoint',
  'portreeve_activation_skip_endpoint',
  'portreeve_activation_abandon_endpoint',
  'portreeve_activation_reconcile',
  'portreeve_activation_end',
  'portreeve_stack_snapshot',
  'portreeve_launcher_operation_begin',
  'portreeve_launcher_operation_renew',
  'portreeve_launcher_operation_complete',
  'portreeve_launcher_operation_get',
  'portreeve_launcher_operations_list',
  'portreeve_settings_update_preview',
  'portreeve_settings_update_execute',
  'portreeve_history_list',
]);

const RECEIPT_OPERATIONS = new Set(
  MCP_TOOL_NAMES.filter(
    (name) => name.endsWith('_preview') || name.endsWith('_execute'),
  ),
);

const CREDENTIAL_OPERATIONS = new Set([
  'portreeve_lease_acquire',
  'portreeve_lease_confirm',
  'portreeve_lease_abandon',
  'portreeve_activation_begin',
  'portreeve_activation_custody_extend',
  'portreeve_activation_confirm_endpoint',
  'portreeve_activation_skip_endpoint',
  'portreeve_activation_abandon_endpoint',
  'portreeve_launcher_operation_begin',
  'portreeve_launcher_operation_renew',
  'portreeve_launcher_operation_complete',
]);

export const MCP_TOOL_CATALOG = Object.freeze(
  MCP_TOOL_NAMES.map((name) =>
    Object.freeze({
      name,
      family: name.split('_')[1] ?? 'diagnostics',
      receiptBound: RECEIPT_OPERATIONS.has(name),
      credentialCustody: CREDENTIAL_OPERATIONS.has(name),
    }),
  ),
);

export const MCP_EXCLUDED_CAPABILITIES = Object.freeze([
  'unsafe-any-owner-eviction',
  'server-lifecycle-administration',
  'arbitrary-shell-execution',
  'arbitrary-filesystem-access',
  'raw-logs-or-command-output',
  'http-mcp-transport',
  'resources',
  'prompts',
  'subscriptions',
]);
