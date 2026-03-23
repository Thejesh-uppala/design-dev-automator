import type { TokenMap, TokenType } from '../types.js';
import { resolveAliasChain } from '../resolver.js';
import { normalizeValue, pathToCssVar, DTCG_TYPE_MAP } from './dtcg.js';

interface RawToken {
  $value: string;
  $type?: string;
}

/**
 * Normalize dot-notation alias references to slash notation.
 * `{colors.blue.600}` → `{colors/blue/600}`
 */
function normalizeDotAliases(value: string): string {
  if (value.startsWith('{') && value.endsWith('}')) {
    const inner = value.slice(1, -1);
    return `{${inner.replace(/\./g, '/')}}`;
  }
  return value;
}

/**
 * Flatten Token Studio nested JSON into a flat map of path → RawToken.
 * Token Studio uses `value`/`type`/`description` (no `$` prefix).
 * Output uses `$value`/`$type` for resolver compatibility.
 */
function flattenTokenStudio(
  obj: Record<string, unknown>,
  prefix: string = '',
): Record<string, RawToken> {
  const result: Record<string, RawToken> = {};

  for (const [key, val] of Object.entries(obj)) {
    // Skip metadata keys (Token Studio may use $ prefixed metadata at group level)
    if (key.startsWith('$')) continue;

    const path = prefix ? `${prefix}/${key}` : key;

    if (val !== null && typeof val === 'object') {
      const node = val as Record<string, unknown>;

      if ('value' in node && typeof node.value === 'string') {
        // Leaf token node — map to $value/$type for resolver compatibility
        result[path] = {
          $value: normalizeDotAliases(node.value),
          $type: typeof node.type === 'string' ? node.type : undefined,
        };
      } else {
        // Recurse into nested groups
        Object.assign(result, flattenTokenStudio(node, path));
      }
    }
  }

  return result;
}

/**
 * Map Token Studio type to internal TokenType (same mapping as DTCG).
 */
function mapType(tsType: string | undefined): TokenType {
  if (!tsType) return 'color';
  return DTCG_TYPE_MAP[tsType] ?? 'color';
}

/**
 * Parse Token Studio JSON into a TokenMap.
 *
 * Token Studio format uses `value`/`type`/`description` (no `$` prefix)
 * and dot-notation aliases (`{colors.blue.600}`).
 *
 * @param json - Parsed Token Studio JSON object
 * @param source - Source identifier (default: "token-studio")
 * @returns Fully resolved TokenMap with lookup maps
 */
export function parseTokenStudio(
  json: Record<string, unknown>,
  source: string = 'token-studio',
): TokenMap {
  const flatTokens = flattenTokenStudio(json);

  const tokenMap: TokenMap = {
    version: '1',
    syncedAt: new Date().toISOString(),
    source,
    tokens: {},
    lookupByValue: {},
    lookupByCssVar: {},
  };

  for (const [path, rawToken] of Object.entries(flatTokens)) {
    const { value, chain } = resolveAliasChain(path, flatTokens);
    const normalizedValue = normalizeValue(value);
    const cssVar = pathToCssVar(path);
    const type = mapType(rawToken.$type);

    tokenMap.tokens[path] = {
      resolvedValue: normalizedValue,
      aliasChain: chain,
      cssVar,
      type,
    };

    // Build lookupByValue
    if (!tokenMap.lookupByValue[normalizedValue]) {
      tokenMap.lookupByValue[normalizedValue] = [];
    }
    if (!tokenMap.lookupByValue[normalizedValue].includes(path)) {
      tokenMap.lookupByValue[normalizedValue].push(path);
    }

    // Build lookupByCssVar
    tokenMap.lookupByCssVar[cssVar] = path;
  }

  return tokenMap;
}
