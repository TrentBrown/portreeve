// @ts-check

import { z } from 'zod';
import { createPortreeveMcpServer } from './bridge.js';
import { MCP_TOOL_CATALOG, MCP_TOOL_NAMES } from './catalog.js';

const DOCUMENTATION_RUN_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Extract the exact tool definitions registered with the pinned MCP SDK without
 * connecting a transport or contacting the PortReeve daemon.
 */
export async function mcpDocumentationCatalog() {
  const server = createPortreeveMcpServer({
    runId: DOCUMENTATION_RUN_ID,
    clientFactory: () => /** @type {any} */ ({}),
  });
  try {
    const registered = /** @type {Record<string, any>} */ (
      /** @type {any} */ (server)._registeredTools
    );
    const actualNames = Object.keys(registered);
    if (
      actualNames.length !== MCP_TOOL_NAMES.length ||
      MCP_TOOL_NAMES.some((name) => registered[name] === undefined)
    ) {
      throw new Error('The registered MCP tools differ from MCP_TOOL_NAMES.');
    }

    const catalogByName = new Map(MCP_TOOL_CATALOG.map((entry) => [entry.name, entry]));
    return MCP_TOOL_NAMES.map((name) => {
      const tool = registered[name];
      const catalog = catalogByName.get(name);
      if (catalog === undefined) throw new Error(`Missing MCP catalog entry: ${name}`);
      const annotations = Object.freeze({
        readOnlyHint: tool.annotations?.readOnlyHint ?? false,
        destructiveHint: tool.annotations?.destructiveHint ?? false,
        idempotentHint: tool.annotations?.idempotentHint ?? false,
        openWorldHint: tool.annotations?.openWorldHint ?? false,
      });
      return Object.freeze({
        id: `mcp-tool-${name.replaceAll('_', '-')}`,
        name,
        title: requiredText(tool.title, `${name} title`),
        description: requiredText(tool.description, `${name} description`),
        family: normalizeFamily(catalog.family),
        safety: annotations.readOnlyHint
          ? 'read-only'
          : annotations.destructiveHint
            ? 'consequential-mutation'
            : 'mutation',
        annotations,
        receiptBound: catalog.receiptBound,
        credentialCustody: catalog.credentialCustody,
        inputSchema: stableJson(z.toJSONSchema(tool.inputSchema)),
        outputSchema: stableJson(tool.outputSchemaJson),
        failureEnvelope: Object.freeze({
          ok: false,
          error: Object.freeze({
            code: 'string',
            message: 'string',
            retryable: 'boolean',
            details: 'object',
          }),
        }),
      });
    });
  } finally {
    await server.close();
  }
}

/** @param {unknown} value @param {string} label */
function requiredText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing ${label}.`);
  }
  return value;
}

/** @param {string} family */
function normalizeFamily(family) {
  return (
    {
      port: 'ports',
      claim: 'claims',
      lease: 'leases',
      run: 'leases',
      stack: 'stacks',
      stacks: 'stacks',
      generation: 'stacks',
      generations: 'stacks',
      activation: 'activations',
      activations: 'activations',
      launcher: 'launchers',
      settings: 'settings',
      history: 'observability',
      compatibility: 'diagnostics',
      diagnostics: 'diagnostics',
      health: 'diagnostics',
      ports: 'ports',
      claims: 'claims',
    }[family] ?? family
  );
}

/** @param {unknown} value @returns {unknown} */
function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableJson(item)]),
    );
  }
  return value;
}
