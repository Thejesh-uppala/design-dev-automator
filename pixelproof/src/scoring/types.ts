import { createHash } from 'node:crypto';

export type ViolationSource =
  | 'jsx-style'
  | 'styled-components'
  | 'emotion'
  | 'css-module'
  | 'vanilla-extract';

export type ViolationConfidence = 'exact' | 'approximate';

export type ViolationType =
  | 'color'
  | 'spacing'
  | 'typography'
  | 'border-radius'
  | 'shadow';

export interface Violation {
  id: string;
  file: string;
  line: number;
  column: number;
  prop: string;
  found: string;
  type: ViolationType;
  nearestToken: string;
  figmaToken: string;
  resolvedValue: string;
  source: ViolationSource;
  confidence: ViolationConfidence;
}

export type RenderStatus = 'pending' | 'rendered' | 'error' | 'skipped';

export interface ComponentScore {
  file: string;
  exports: string[];
  tokenCompliance: number | null;
  renderFidelity: number | null;
  renderStatus: RenderStatus;
  violations: Violation[];
}

export interface AggregateScore {
  tokenCompliance: number;
  renderFidelity: number;
  totalComponents: number;
  renderedComponents: number;
  skippedComponents: number;
  totalViolations: number;
}

export interface ScoreEvent {
  type: 'violation' | 'render';
  file: string;
}

/**
 * Generate a deterministic violation ID: sha1(file + line + found).
 */
export function violationId(
  file: string,
  line: number,
  found: string,
): string {
  return createHash('sha1')
    .update(`${file}${line}${found}`)
    .digest('hex');
}
