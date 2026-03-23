import { CyclicAliasError, MaxDepthError } from './types.js';

const MAX_DEPTH = 20;

interface RawToken {
  $value: string;
  $type?: string;
}

export interface ResolveResult {
  value: string;
  chain: string[];
}

/**
 * Resolve an alias chain for a given token key.
 * Aliases are values like `{colors/blue/600}` — braces indicate a reference.
 *
 * @returns The resolved literal value and the full chain of keys traversed.
 * @throws CyclicAliasError if a cycle is detected.
 * @throws MaxDepthError if the chain exceeds 20 levels.
 */
export function resolveAliasChain(
  key: string,
  flatTokens: Record<string, RawToken>,
  chain: string[] = [],
): ResolveResult {
  if (chain.includes(key)) {
    throw new CyclicAliasError([...chain, key]);
  }

  if (chain.length >= MAX_DEPTH) {
    throw new MaxDepthError(MAX_DEPTH);
  }

  const token = flatTokens[key];
  if (!token) {
    throw new Error(`Token not found: ${key}`);
  }

  const value = token.$value;

  // Check if value is an alias reference: starts with { and ends with }
  if (value.startsWith('{') && value.endsWith('}')) {
    const aliasKey = value.slice(1, -1);
    return resolveAliasChain(aliasKey, flatTokens, [...chain, key]);
  }

  return { value, chain: [...chain, key] };
}
