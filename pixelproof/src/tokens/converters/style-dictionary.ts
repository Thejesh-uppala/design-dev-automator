import type { TokenMap, TokenType } from '../types.js';
import { normalizeValue, pathToCssVar } from './dtcg.js';

/**
 * Infer TokenType from a CSS value string.
 * hex/rgb/hsl → color, px/rem/em → spacing, fallback → color.
 */
export function inferTypeFromValue(value: string): TokenType {
  if (/^#[0-9a-fA-F]{3,6}$/.test(value)) return 'color';
  if (/^rgb/i.test(value) || /^hsl/i.test(value)) return 'color';
  if (/^\d+(\.\d+)?(px|rem|em)$/.test(value)) return 'spacing';
  return 'color';
}

/**
 * Parse Style Dictionary CSS custom properties output into a TokenMap.
 *
 * Extracts `--name: value;` declarations from CSS strings.
 * Token path = var name without `--` prefix.
 * No alias resolution — SD CSS output is already resolved.
 */
export function parseStyleDictionaryCSS(
  css: string,
  source: string = 'style-dictionary-css',
): TokenMap {
  const tokenMap: TokenMap = {
    version: '1',
    syncedAt: new Date().toISOString(),
    source,
    tokens: {},
    lookupByValue: {},
    lookupByCssVar: {},
  };

  // Match all CSS custom property declarations: --name: value;
  const declRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;

  while ((match = declRegex.exec(css)) !== null) {
    const varName = match[1]; // without --
    const rawValue = match[2].trim();
    const path = varName; // token path = var name without --
    const cssVar = `--${varName}`;
    const normalizedValue = normalizeValue(rawValue);
    const type = inferTypeFromValue(rawValue);

    tokenMap.tokens[path] = {
      resolvedValue: normalizedValue,
      aliasChain: [path],
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

/**
 * Flatten a nested Style Dictionary JS object into flat path → value pairs.
 * A node is a token if it has a `value` property (string).
 */
function flattenSDJS(
  obj: Record<string, unknown>,
  prefix: string = '',
): Array<{ path: string; value: string; type?: string }> {
  const result: Array<{ path: string; value: string; type?: string }> = [];

  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}/${key}` : key;

    if (val !== null && typeof val === 'object') {
      const node = val as Record<string, unknown>;

      if ('value' in node && typeof node.value === 'string') {
        result.push({
          path,
          value: node.value,
          type: typeof node.type === 'string' ? node.type : undefined,
        });
      } else {
        result.push(...flattenSDJS(node, path));
      }
    }
  }

  return result;
}

/**
 * Parse Style Dictionary JS/TS export (nested object with `value` at leaf nodes) into a TokenMap.
 *
 * No alias resolution — SD JS output is already resolved.
 */
export function parseStyleDictionaryJS(
  obj: Record<string, unknown>,
  source: string = 'style-dictionary-js',
): TokenMap {
  const tokenMap: TokenMap = {
    version: '1',
    syncedAt: new Date().toISOString(),
    source,
    tokens: {},
    lookupByValue: {},
    lookupByCssVar: {},
  };

  const flatTokens = flattenSDJS(obj);

  for (const { path, value, type } of flatTokens) {
    const normalizedValue = normalizeValue(value);
    const cssVar = pathToCssVar(path);
    const tokenType: TokenType = type
      ? inferTypeFromValue(value) // type field not standardized in SD JS; infer from value
      : inferTypeFromValue(value);

    tokenMap.tokens[path] = {
      resolvedValue: normalizedValue,
      aliasChain: [path],
      cssVar,
      type: tokenType,
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
