/**
 * Figma Variable → Internal TokenMap Converter
 *
 * Transforms raw Figma variable data (from MCP or REST API) into the
 * internal TokenMap format. Distinct from DTCG/SD/TS converters — Figma's
 * variable structure has its own resolution and type-mapping logic.
 */

import type { TokenMap, TokenType } from '../types.js';
import type {
  RawFigmaVariables,
  RawFigmaVariable,
  FigmaColor,
  FigmaVariableAlias,
  FigmaVariableValue,
} from '../figma-types.js';
import { normalizeValue, pathToCssVar } from './dtcg.js';

/**
 * Map Figma variable resolvedType to internal TokenType.
 * FLOAT and STRING are contextual — use path prefix as a hint.
 */
function mapFigmaType(
  resolvedType: RawFigmaVariable['resolvedType'],
  name: string,
): TokenType {
  switch (resolvedType) {
    case 'COLOR':
      return 'color';
    case 'FLOAT': {
      const lower = name.toLowerCase();
      if (lower.includes('radius')) return 'border-radius';
      if (lower.includes('shadow')) return 'shadow';
      return 'spacing';
    }
    case 'STRING': {
      const lower = name.toLowerCase();
      if (lower.includes('font') || lower.includes('typography') || lower.includes('text')) {
        return 'typography';
      }
      return 'color'; // fallback
    }
    case 'BOOLEAN':
      return 'color'; // fallback — booleans don't map to design tokens well
    default:
      return 'color';
  }
}

/**
 * Check if a value is a Figma color object { r, g, b, a }.
 */
function isFigmaColor(value: unknown): value is FigmaColor {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.r === 'number' &&
    typeof v.g === 'number' &&
    typeof v.b === 'number' &&
    typeof v.a === 'number'
  );
}

/**
 * Check if a value is a Figma variable alias.
 */
function isVariableAlias(value: unknown): value is FigmaVariableAlias {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.type === 'VARIABLE_ALIAS' && typeof v.id === 'string';
}

/**
 * Convert Figma RGBA (0–1 range) to hex string.
 * If alpha < 1, returns rgba() notation. Otherwise returns #rrggbb.
 */
export function figmaColorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  if (color.a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${parseFloat(color.a.toFixed(2))})`;
  }

  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  return hex.toLowerCase();
}

/**
 * Convert a Figma variable value to a string representation.
 */
function valueToString(value: FigmaVariableValue): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (isFigmaColor(value)) return figmaColorToHex(value);
  return String(value);
}

/**
 * Determine which mode to use for a variable collection.
 * Matches by theme name (case-insensitive). Falls back to first mode.
 */
function selectMode(
  modes: Array<{ modeId: string; name: string }>,
  theme: string,
): string {
  const match = modes.find(
    (m) => m.name.toLowerCase() === theme.toLowerCase(),
  );
  return match ? match.modeId : modes[0].modeId;
}

/**
 * Resolve a Figma variable alias chain to a literal value.
 * Returns the resolved value string and the alias chain (variable names).
 */
function resolveAliasChain(
  variableId: string,
  variables: Record<string, RawFigmaVariable>,
  modeSelections: Map<string, string>,
  visited: string[] = [],
): { value: string; chain: string[] } {
  if (visited.includes(variableId)) {
    // Cyclic alias — return placeholder
    return { value: '<cyclic>', chain: visited };
  }

  const variable = variables[variableId];
  if (!variable) {
    return { value: '<unresolved>', chain: visited };
  }

  const modeId = modeSelections.get(variable.variableCollectionId);
  const modeValue = modeId
    ? variable.valuesByMode[modeId]
    : Object.values(variable.valuesByMode)[0];

  if (modeValue === undefined) {
    return { value: '<no-value>', chain: [...visited, variable.name] };
  }

  if (isVariableAlias(modeValue)) {
    return resolveAliasChain(
      modeValue.id,
      variables,
      modeSelections,
      [...visited, variable.name],
    );
  }

  return {
    value: valueToString(modeValue),
    chain: [...visited, variable.name],
  };
}

/**
 * Convert raw Figma variables to internal TokenMap format.
 *
 * @param raw - Raw Figma variable data from MCP or REST client
 * @param theme - Theme name to select mode (default: 'light')
 * @returns TokenMap identical in structure to DTCG converter output
 */
export function convertFigmaVariables(
  raw: RawFigmaVariables,
  theme: string = 'light',
): TokenMap {
  // Pre-compute mode selections for each collection
  const modeSelections = new Map<string, string>();
  for (const [collId, collection] of Object.entries(raw.collections)) {
    modeSelections.set(collId, selectMode(collection.modes, theme));
  }

  const tokenMap: TokenMap = {
    version: '1',
    syncedAt: new Date().toISOString(),
    source: 'figma',
    tokens: {},
    lookupByValue: {},
    lookupByCssVar: {},
  };

  for (const [varId, variable] of Object.entries(raw.variables)) {
    // Use forward-slash separated name as token path
    const tokenPath = variable.name;

    // Resolve the value (following alias chains)
    const { value, chain } = resolveAliasChain(
      varId,
      raw.variables,
      modeSelections,
    );

    // Normalize the value (hex normalization, etc.)
    const normalizedValue = normalizeValue(value);
    const cssVar = pathToCssVar(tokenPath);
    const type = mapFigmaType(variable.resolvedType, tokenPath);

    tokenMap.tokens[tokenPath] = {
      resolvedValue: normalizedValue,
      aliasChain: chain,
      cssVar,
      type,
    };

    // Build lookupByValue
    if (!tokenMap.lookupByValue[normalizedValue]) {
      tokenMap.lookupByValue[normalizedValue] = [];
    }
    if (!tokenMap.lookupByValue[normalizedValue].includes(tokenPath)) {
      tokenMap.lookupByValue[normalizedValue].push(tokenPath);
    }

    // Build lookupByCssVar
    tokenMap.lookupByCssVar[cssVar] = tokenPath;
  }

  return tokenMap;
}
