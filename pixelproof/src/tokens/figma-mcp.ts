/**
 * Figma MCP Client — Tier 1 token fetch.
 *
 * Connects to a Figma MCP server to fetch variables. MCP handles auth
 * via the editor environment — no PAT needed on this path.
 *
 * Expected MCP tool: `get_local_variables`
 *   Arguments: { file_key: string }
 *   Returns: { meta: { variables: {...}, variableCollections: {...} } }
 *
 * The MCP SDK (`@modelcontextprotocol/sdk`) is dynamically imported.
 * If not installed, MCP is considered unavailable and `null` is returned.
 */

import type {
  RawFigmaVariables,
  RawFigmaVariable,
  RawFigmaVariableCollection,
} from './figma-types.js';

const MCP_TIMEOUT_MS = 30_000;

/**
 * Normalize the raw MCP tool response into RawFigmaVariables.
 */
export function normalizeMCPResponse(result: unknown): RawFigmaVariables {
  const data = result as Record<string, unknown>;
  const meta = (data.meta ?? data) as Record<string, unknown>;

  const rawVars = (meta.variables ?? {}) as Record<string, Record<string, unknown>>;
  const rawColls = (meta.variableCollections ?? {}) as Record<string, Record<string, unknown>>;

  const variables: Record<string, RawFigmaVariable> = {};
  for (const [id, v] of Object.entries(rawVars)) {
    variables[id] = {
      id: (v.id as string) ?? id,
      name: v.name as string,
      resolvedType: v.resolvedType as RawFigmaVariable['resolvedType'],
      variableCollectionId: v.variableCollectionId as string,
      valuesByMode: v.valuesByMode as RawFigmaVariable['valuesByMode'],
    };
  }

  const collections: Record<string, RawFigmaVariableCollection> = {};
  for (const [id, c] of Object.entries(rawColls)) {
    collections[id] = {
      id: (c.id as string) ?? id,
      name: c.name as string,
      modes: c.modes as RawFigmaVariableCollection['modes'],
    };
  }

  return { variables, collections };
}

/**
 * Fetch Figma variables via MCP server.
 *
 * Returns `null` if MCP is unavailable (SDK not installed, server not
 * running, timeout, or any connection error). Does NOT throw.
 */
export async function fetchViaFigmaMCP(
  fileId: string,
): Promise<RawFigmaVariables | null> {
  try {
    // Dynamic import — MCP SDK is optional
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/stdio.js'
    );

    const serverCommand = process.env.FIGMA_MCP_COMMAND ?? 'npx';
    const serverArgs = process.env.FIGMA_MCP_ARGS
      ? process.env.FIGMA_MCP_ARGS.split(' ')
      : ['-y', '@anthropic-ai/figma-mcp-server'];

    const transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
    });

    const client = new Client(
      { name: 'pixelproof', version: '0.1.0' },
      { capabilities: {} },
    );

    // Race connect + call against timeout
    const result = await Promise.race([
      (async () => {
        await client.connect(transport);

        const toolResult = await client.callTool({
          name: 'get_local_variables',
          arguments: { file_key: fileId },
        });

        await client.close();
        return toolResult;
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MCP timeout')), MCP_TIMEOUT_MS),
      ),
    ]);

    // Extract content from MCP tool result
    const content = extractToolContent(result);
    if (!content) return null;

    return normalizeMCPResponse(content);
  } catch {
    // MCP unavailable — SDK not installed, server error, timeout, etc.
    return null;
  }
}

/**
 * Extract usable content from an MCP tool result.
 * MCP tool results contain an array of content blocks.
 */
function extractToolContent(result: unknown): unknown {
  if (!result || typeof result !== 'object') return null;

  const r = result as Record<string, unknown>;

  // MCP SDK returns { content: [{ type: 'text', text: '...' }] }
  if (Array.isArray(r.content) && r.content.length > 0) {
    const first = r.content[0] as Record<string, unknown>;
    if (first.type === 'text' && typeof first.text === 'string') {
      try {
        return JSON.parse(first.text);
      } catch {
        return null;
      }
    }
  }

  // Direct object result
  return r;
}
