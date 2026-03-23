import type { TokenMap, TokenType } from '../types.js';
import { resolveAliasChain } from '../resolver.js';

interface RawToken {
  $value: string;
  $type?: string;
  $description?: string;
}

export const DTCG_TYPE_MAP: Record<string, TokenType> = {
  color: 'color',
  dimension: 'spacing',
  fontFamily: 'typography',
  fontSize: 'typography',
  fontWeight: 'typography',
  lineHeight: 'typography',
  borderRadius: 'border-radius',
  shadow: 'shadow',
};

/**
 * Normalize hex color values: expand shorthand, lowercase.
 * Non-hex values are returned as-is.
 */
export function normalizeValue(value: string): string {
  // Match 3-digit hex: #abc → #aabbcc
  const shortHex = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;
  const match = value.match(shortHex);
  if (match) {
    return `#${match[1]}${match[1]}${match[2]}${match[2]}${match[3]}${match[3]}`.toLowerCase();
  }

  // Match 6-digit hex: lowercase
  const longHex = /^#[0-9a-fA-F]{6}$/;
  if (longHex.test(value)) {
    return value.toLowerCase();
  }

  return value;
}

/**
 * Convert token path to CSS variable name.
 * `colors/brand/primary` → `--colors-brand-primary`
 */
export function pathToCssVar(tokenPath: string): string {
  return `--${tokenPath.replace(/\//g, '-')}`;
}

/**
 * Map DTCG $type to internal TokenType.
 */
function mapType(dtcgType: string | undefined): TokenType {
  if (!dtcgType) return 'color';
  return DTCG_TYPE_MAP[dtcgType] ?? 'color';
}

/**
 * Flatten nested DTCG JSON into a flat map of path → raw token.
 * A node is a token if it has a `$value` property.
 */
function flattenDTCG(
  obj: Record<string, unknown>,
  prefix: string = '',
): Record<string, RawToken> {
  const result: Record<string, RawToken> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip DTCG metadata keys
    if (key.startsWith('$')) continue;

    const path = prefix ? `${prefix}/${key}` : key;

    if (value !== null && typeof value === 'object') {
      const node = value as Record<string, unknown>;

      if ('$value' in node && typeof node.$value === 'string') {
        result[path] = {
          $value: node.$value,
          $type: typeof node.$type === 'string' ? node.$type : undefined,
          $description: typeof node.$description === 'string' ? node.$description : undefined,
        };
      } else {
        // Recurse into nested groups
        Object.assign(result, flattenDTCG(node, path));
      }
    }
  }

  return result;
}

/**
 * Parse W3C DTCG JSON into a TokenMap.
 *
 * @param json - Parsed DTCG JSON object
 * @param source - Source identifier (default: "dtcg")
 * @returns Fully resolved TokenMap with lookup maps
 */
export function parseDTCG(
  json: Record<string, unknown>,
  source: string = 'dtcg',
): TokenMap {
  const flatTokens = flattenDTCG(json);

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
