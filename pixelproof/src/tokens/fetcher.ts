/**
 * Fetch Layer Orchestrator — Three-tier token fetch hierarchy.
 *
 * 1. Figma MCP   ← preferred (zero config, editor handles auth)
 * 2. REST API + PAT  ← fallback (for non-MCP editors)
 * 3. Local tokens/   ← offline fallback (E1-S5)
 *
 * Same TokenMap output regardless of source.
 */

import type { PixelProofConfig } from '../config/schema.js';
import type { TokenMap } from './types.js';
import { fetchViaFigmaMCP } from './figma-mcp.js';
import { fetchViaFigmaREST, resolvePAT } from './figma-rest.js';
import { convertFigmaVariables } from './converters/figma.js';
import { loadLocalTokens } from './loader.js';
import { readCache, writeCache, isCacheFresh } from './cache.js';
import { resolve } from 'node:path';

export interface FetchResult {
  tokenMap: TokenMap;
  source: 'mcp' | 'rest-api' | 'local' | 'cache';
}

const CACHE_DIR_NAME = '.pixelproof';

/**
 * Fetch tokens using the three-tier hierarchy.
 *
 * If cache is fresh and `force` is not set, returns cached tokens.
 * Otherwise tries MCP → REST API → local tokens, in order.
 *
 * @param config - PixelProof configuration
 * @param rootDir - Project root directory
 * @param options - { force: true } to bypass cache freshness check
 * @returns FetchResult with tokenMap and source identifier
 * @throws When no token source is available
 */
export async function fetchTokens(
  config: PixelProofConfig,
  rootDir: string,
  options: { force?: boolean } = {},
): Promise<FetchResult> {
  const cacheDir = resolve(rootDir, CACHE_DIR_NAME);
  const syncTTL = config.figma?.syncTTL ?? 86400;

  // Check cache freshness (unless force)
  if (!options.force) {
    const cached = readCache(cacheDir);
    if (cached && isCacheFresh(cached, syncTTL)) {
      const age = Date.now() - Date.parse(cached.syncedAt);
      const agoStr = formatTimeAgo(age);
      console.log(`Using cached tokens (synced ${agoStr} ago)`);
      return { tokenMap: cached, source: 'cache' };
    }
  }

  const theme = config.render?.theme ?? 'light';

  // Snapshot stale cache before local tokens might overwrite it
  const existingCache = readCache(cacheDir);

  // Tier 1: Figma MCP
  if (config.figma?.fileId) {
    try {
      const raw = await fetchViaFigmaMCP(config.figma.fileId);
      if (raw) {
        const tokenMap = convertFigmaVariables(raw, theme);
        tokenMap.source = 'mcp';
        writeCache(cacheDir, tokenMap);
        console.log('Tokens fetched via Figma MCP');
        return { tokenMap, source: 'mcp' };
      }
    } catch {
      // MCP failure is expected — debug-level only
    }
  }

  // Tier 2: Figma REST API
  const pat = resolvePAT(config.figma?.personalAccessToken);
  if (config.figma?.fileId && pat) {
    try {
      const raw = await fetchViaFigmaREST(config.figma.fileId, pat);
      const tokenMap = convertFigmaVariables(raw, theme);
      tokenMap.source = 'rest-api';
      writeCache(cacheDir, tokenMap);
      console.log('Tokens fetched via Figma REST API');
      return { tokenMap, source: 'rest-api' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`Figma REST API failed: ${msg}`);

      // If we have a stale cache, use it
      if (existingCache && Object.keys(existingCache.tokens).length > 0) {
        console.warn(
          `Figma sync failed — using cached tokens from ${existingCache.syncedAt}`,
        );
        return { tokenMap: existingCache, source: 'cache' };
      }
    }
  }

  // Tier 3: Local tokens
  try {
    const tokenMap = loadLocalTokens(rootDir, config.tokens);
    if (Object.keys(tokenMap.tokens).length > 0) {
      console.log(`Using local token files from ${config.tokens.fallbackDir}`);
      return { tokenMap, source: 'local' };
    }
  } catch {
    // Local tokens failed
  }

  // Check existing cache as last resort (must have actual tokens)
  if (existingCache && Object.keys(existingCache.tokens).length > 0) {
    console.warn(
      `Figma sync failed — using cached tokens from ${existingCache.syncedAt}`,
    );
    return { tokenMap: existingCache, source: 'cache' };
  }

  throw new Error(
    'No token source available. Provide Figma MCP, a Figma PAT, or local token files in tokens/',
  );
}

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}
