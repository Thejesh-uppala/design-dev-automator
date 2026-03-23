/**
 * CSS style property matching, value pattern detection, and violation checking.
 *
 * Core utilities used by all AST engines to determine whether a CSS value
 * is a token violation (hardcoded value that should use a design token).
 */

import type { TokenMap } from '../tokens/types.js';
import { isWhitelisted } from './whitelist.js';

/**
 * CSS property names eligible for token compliance checking.
 * Includes camelCase (JSX) forms. kebab-case conversion handled separately.
 */
export const CSS_STYLE_PROPS = new Set([
  // Colors
  'color', 'backgroundColor', 'background', 'borderColor', 'border',
  'fill', 'stroke', 'outlineColor', 'outline',
  // Typography
  'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'letterSpacing',
  // Spacing
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'gap', 'rowGap', 'columnGap',
  // Sizing
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'top', 'right', 'bottom', 'left',
  // Border radius
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius',
  // Shadows
  'boxShadow', 'textShadow',
]);

/**
 * kebab-case equivalents for CSS module / postcss matching.
 */
export const CSS_STYLE_PROPS_KEBAB = new Set([
  'color', 'background-color', 'background', 'border-color', 'border',
  'fill', 'stroke', 'outline-color', 'outline',
  'font-size', 'font-family', 'font-weight', 'line-height', 'letter-spacing',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'row-gap', 'column-gap',
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'top', 'right', 'bottom', 'left',
  'border-radius', 'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'box-shadow', 'text-shadow',
]);

/**
 * Regex matching raw hardcoded CSS values.
 * Matches: hex colors, rgb/rgba, hsl/hsla, px values, em/rem values.
 */
export const VALUE_PATTERN =
  /(?:#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+|hsla?\(\s*\d+|\d+\.?\d*px|\d+\.?\d*(?:em|rem))\b/;

/**
 * Normalize a CSS value for token map lookup.
 * - Hex: #fff → #ffffff, lowercase
 * - RGB: rgb(99, 102, 241) → #6366f1
 * - Numeric values: preserved as-is
 */
export function normalizeForLookup(value: string): string {
  const trimmed = value.trim().toLowerCase();

  // Hex normalization: #abc → #aabbcc
  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    return `#${hex}`;
  }

  // RGB/RGBA → hex conversion
  const rgbMatch = trimmed.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/,
  );
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;

    if (a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  return trimmed;
}

/**
 * Core violation check.
 *
 * 1. If whitelisted → false
 * 2. If doesn't match VALUE_PATTERN → false (dynamic expression, CSS var)
 * 3. Normalize value
 * 4. If normalized NOT in tokenMap.lookupByValue → false (precision mode)
 * 5. Return true — this is a violation
 */
export function isViolation(
  value: string,
  _prop: string,
  tokenMap: TokenMap,
): boolean {
  if (isWhitelisted(value)) return false;
  if (!VALUE_PATTERN.test(value)) return false;

  const normalized = normalizeForLookup(value);
  if (!tokenMap.lookupByValue[normalized]) return false;

  return true;
}

/**
 * Given a violation value, return the token path(s) from lookupByValue.
 */
export function findNearestToken(
  value: string,
  tokenMap: TokenMap,
): string[] {
  const normalized = normalizeForLookup(value);
  return tokenMap.lookupByValue[normalized] ?? [];
}

/**
 * Determine the ViolationType from a CSS property name.
 */
export function violationTypeFromProp(
  prop: string,
): 'color' | 'spacing' | 'typography' | 'border-radius' | 'shadow' {
  const lower = prop.toLowerCase();

  if (
    lower.includes('color') || lower === 'background' || lower === 'fill' ||
    lower === 'stroke' || lower === 'outline' || lower === 'border'
  ) {
    return 'color';
  }
  if (lower.includes('font') || lower.includes('line-height') ||
    lower.includes('lineheight') || lower.includes('letter') ||
    lower.includes('typography')) {
    return 'typography';
  }
  if (lower.includes('radius')) return 'border-radius';
  if (lower.includes('shadow')) return 'shadow';
  return 'spacing';
}

/**
 * Check if a CSS property is token-eligible (camelCase or kebab-case).
 */
export function isTokenEligibleProp(prop: string): boolean {
  return CSS_STYLE_PROPS.has(prop) || CSS_STYLE_PROPS_KEBAB.has(prop);
}

/**
 * Extract individual values from a multi-value CSS declaration.
 * e.g., "1px solid #6366f1" → ["1px", "solid", "#6366f1"]
 */
export function extractValues(value: string): string[] {
  // Don't split rgb/rgba/hsl/hsla function calls
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (const char of value) {
    if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth--;
      current += char;
    } else if (char === ' ' && parenDepth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts;
}
