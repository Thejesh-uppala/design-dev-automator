/**
 * JSX Style Prop Engine — E3-S2
 *
 * Detects violations in JSX `style` prop objects:
 *   <div style={{ color: '#6366f1' }} />
 */

import type { Node } from '@babel/types';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { TokenMap } from '../../tokens/types.js';
import type { Violation, ViolationSource } from '../../scoring/types.js';
import { violationId } from '../../scoring/types.js';
import {
  CSS_STYLE_PROPS,
  isViolation,
  findNearestToken,
  violationTypeFromProp,
} from '../matchers.js';

// Handle CJS/ESM interop for @babel/traverse
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const traverse: (ast: t.Node, opts: import('@babel/traverse').TraverseOptions) => void =
  typeof (_traverse as any).default === 'function'
    ? (_traverse as any).default
    : _traverse as any;

export interface EngineResult {
  violations: Violation[];
  totalProperties: number;
}

const SOURCE: ViolationSource = 'jsx-style';

/**
 * Scan a Babel AST for JSX inline style violations.
 */
export function scanJSXStyles(
  ast: Node,
  filePath: string,
  tokenMap: TokenMap,
): EngineResult {
  const violations: Violation[] = [];
  let totalProperties = 0;

  traverse(ast, {
    JSXAttribute(path: NodePath<t.JSXAttribute>) {
      const name = path.node.name;
      if (!('name' in name) || name.name !== 'style') return;

      const value = path.node.value;
      if (!value || value.type !== 'JSXExpressionContainer') return;

      const expr = value.expression;
      if (expr.type !== 'ObjectExpression') return;

      processObjectExpression(expr, filePath, tokenMap, violations, {
        count: 0,
      }, (count) => { totalProperties += count; });
    },
  });

  return { violations, totalProperties };
}

function processObjectExpression(
  obj: Node & { type: 'ObjectExpression' },
  filePath: string,
  tokenMap: TokenMap,
  violations: Violation[],
  _counter: { count: number },
  addProps: (count: number) => void,
): void {
  let count = 0;

  for (const prop of obj.properties) {
    if (prop.type !== 'ObjectProperty') continue; // skip spread

    const keyName = getKeyName(prop.key);
    if (!keyName || !CSS_STYLE_PROPS.has(keyName)) continue;

    const value = extractStaticValue(prop.value, keyName);
    if (value === null) continue; // dynamic, skip

    count++;

    if (isViolation(value, keyName, tokenMap)) {
      const tokens = findNearestToken(value, tokenMap);
      const tokenEntry = tokens.length > 0 ? tokenMap.tokens[tokens[0]] : null;

      violations.push({
        id: violationId(filePath, prop.loc?.start.line ?? 0, value),
        file: filePath,
        line: prop.loc?.start.line ?? 0,
        column: prop.loc?.start.column ?? 0,
        prop: keyName,
        found: value,
        type: violationTypeFromProp(keyName),
        nearestToken: tokens[0] ?? '',
        figmaToken: tokenEntry?.cssVar ?? '',
        resolvedValue: tokenEntry?.resolvedValue ?? value,
        source: SOURCE,
        confidence: 'exact',
      });
    }
  }

  addProps(count);
}

function getKeyName(key: Node): string | null {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'StringLiteral') return key.value;
  return null;
}

function extractStaticValue(value: Node, prop: string): string | null {
  if (value.type === 'StringLiteral') return value.value;
  if (value.type === 'NumericLiteral') {
    // Numeric on spacing props → append px for lookup
    const spacingProps = new Set([
      'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
      'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'gap', 'rowGap', 'columnGap', 'width', 'height',
      'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
      'top', 'right', 'bottom', 'left',
      'fontSize', 'lineHeight', 'letterSpacing',
      'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
      'borderBottomLeftRadius', 'borderBottomRightRadius',
    ]);
    if (spacingProps.has(prop)) {
      return `${value.value}px`;
    }
    return String(value.value);
  }
  if (value.type === 'TemplateLiteral' && value.expressions.length === 0) {
    return value.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
  }
  return null; // dynamic expression, can't analyze
}
