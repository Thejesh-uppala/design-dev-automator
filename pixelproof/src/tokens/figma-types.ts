/**
 * Raw Figma variable types — the normalized intermediate format
 * returned by both MCP and REST API clients before conversion to TokenMap.
 *
 * Mirrors the Figma Variables REST API response structure:
 * GET /v1/files/:file_key/variables/local
 */

export interface FigmaColor {
  r: number; // 0–1
  g: number;
  b: number;
  a: number;
}

export interface FigmaVariableAlias {
  type: 'VARIABLE_ALIAS';
  id: string;
}

export type FigmaVariableValue =
  | number
  | string
  | boolean
  | FigmaColor
  | FigmaVariableAlias;

export interface RawFigmaVariable {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  variableCollectionId: string;
  valuesByMode: Record<string, FigmaVariableValue>;
}

export interface RawFigmaVariableCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
}

export interface RawFigmaVariables {
  variables: Record<string, RawFigmaVariable>;
  collections: Record<string, RawFigmaVariableCollection>;
}
