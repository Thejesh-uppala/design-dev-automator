/**
 * Figma REST API Client — Tier 2 token fetch (PAT fallback).
 *
 * Uses Personal Access Token authentication to fetch variables from the
 * Figma REST API. Rate-limit aware with exponential backoff.
 *
 * Endpoints used:
 *   GET /v1/files/:file_key/variables/local
 *   GET /v1/files/:file_key/variables/published
 *
 * PAT is NEVER logged, NEVER included in error messages.
 */

import type {
  RawFigmaVariables,
  RawFigmaVariable,
  RawFigmaVariableCollection,
} from './figma-types.js';

const FIGMA_API_BASE = 'https://api.figma.com';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

class RateLimitError extends Error {
  constructor() {
    super('Figma API rate limit exceeded');
    this.name = 'RateLimitError';
  }
}

/**
 * Make an authenticated Figma API request with timeout.
 */
async function figmaFetch(
  path: string,
  pat: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${FIGMA_API_BASE}${path}`, {
      headers: { 'X-FIGMA-TOKEN': pat },
      signal: controller.signal,
    });

    if (response.status === 403) {
      throw new Error(
        'Figma PAT is invalid or expired. Generate a new token at figma.com/settings',
      );
    }

    if (response.status === 404) {
      const fileId = path.split('/')[3] ?? 'unknown';
      throw new Error(`Figma file not found: ${fileId}`);
    }

    if (response.status === 429) {
      throw new RateLimitError();
    }

    if (!response.ok) {
      throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch with exponential backoff on rate limit (429).
 * Retries up to MAX_RETRIES times with 1s, 2s, 4s delays.
 */
async function figmaFetchWithRetry(
  path: string,
  pat: string,
): Promise<unknown> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await figmaFetch(path, pat);
    } catch (error) {
      lastError = error as Error;

      if (error instanceof RateLimitError && attempt < MAX_RETRIES) {
        const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Normalize the Figma REST API response into RawFigmaVariables.
 */
function normalizeResponse(data: unknown): RawFigmaVariables {
  const response = data as Record<string, unknown>;
  const meta = (response.meta ?? response) as Record<string, unknown>;

  const rawVars = (meta.variables ?? {}) as Record<string, Record<string, unknown>>;
  const rawColls = (meta.variableCollections ?? {}) as Record<
    string,
    Record<string, unknown>
  >;

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
 * Merge two RawFigmaVariables objects. `primary` takes precedence on conflict.
 */
function mergeRawVariables(
  primary: RawFigmaVariables,
  secondary: RawFigmaVariables,
): RawFigmaVariables {
  return {
    variables: { ...secondary.variables, ...primary.variables },
    collections: { ...secondary.collections, ...primary.collections },
  };
}

/**
 * Resolve the PAT from available sources.
 * Priority: FIGMA_PAT env var → explicit pat parameter.
 */
export function resolvePAT(configPat?: string): string | null {
  return process.env.FIGMA_PAT ?? configPat ?? null;
}

/**
 * Fetch Figma variables via REST API using PAT authentication.
 *
 * Fetches both local and published variables, merging them (local takes
 * precedence on conflict). Retries on rate limit with exponential backoff.
 *
 * @throws On auth error (403), file not found (404), persistent rate limit, or network error.
 */
export async function fetchViaFigmaREST(
  fileId: string,
  pat: string,
): Promise<RawFigmaVariables> {
  // Fetch local variables
  const localData = await figmaFetchWithRetry(
    `/v1/files/${fileId}/variables/local`,
    pat,
  );
  const localVars = normalizeResponse(localData);

  // Fetch published variables (merge — local takes precedence)
  try {
    const publishedData = await figmaFetchWithRetry(
      `/v1/files/${fileId}/variables/published`,
      pat,
    );
    const publishedVars = normalizeResponse(publishedData);
    return mergeRawVariables(localVars, publishedVars);
  } catch {
    // Published endpoint may fail (e.g., no published variables) — use local only
    return localVars;
  }
}
