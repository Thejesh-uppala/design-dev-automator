/**
 * Emotion Engine — E3-S5
 *
 * Detects violations in Emotion's css prop (object + template) and styled() API.
 *   <div css={{ color: '#6366f1' }} />
 *   <div css={css`color: #6366f1;`} />
 *   css({ color: '#6366f1' })
 *   styled.button`color: #6366f1;`
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
import { parseCSSAndCheck } from './styled-components.js';

const traverse = (typeof _traverse === 'function' ? _traverse : (_traverse as unknown as { default: typeof _traverse }).default) as typeof _traverse;

export interface EngineResult {
  violations: Violation[];
  totalProperties: number;
}

const SOURCE: ViolationSource = 'emotion';

/**
 * Scan a Babel AST for Emotion css prop and API violations.
 * Does NOT process `style` props — that's the JSX engine's job.
 */
export function scanEmotion(
  ast: Node,
  filePath: string,
  tokenMap: TokenMap,
): EngineResult {
  const violations: Violation[] = [];
  let totalProperties = 0;

  traverse(ast, {
    // css prop: <div css={{ color: '#6366f1' }} />
    JSXAttribute(path: NodePath<t.JSXAttribute>) {
      const name = path.node.name;
      if (!('name' in name) || name.name !== 'css') return;

      const value = path.node.value;
      if (!value || value.type !== 'JSXExpressionContainer') return;

      const expr = value.expression;

      // Object syntax: css={{ color: '#6366f1' }}
      if (expr.type === 'ObjectExpression') {
        const result = processObjectExpression(expr, filePath, tokenMap);
        violations.push(...result.violations);
        totalProperties += result.totalProperties;
      }

      // Template syntax: css={css`color: #6366f1;`}
      if (
        expr.type === 'TaggedTemplateExpression' &&
        expr.tag.type === 'Identifier' &&
        expr.tag.name === 'css'
      ) {
        const css = extractCSS(expr.quasi);
        const lineOffset = expr.quasi.loc?.start.line ?? 0;
        const result = parseCSSAndCheck(css, filePath, tokenMap, lineOffset, SOURCE);
        violations.push(...result.violations);
        totalProperties += result.totalProperties;
      }
    },

    // css() call: css({ color: '#6366f1' })
    // css`color: #6366f1;` tagged template
    CallExpression(path: NodePath<t.CallExpression>) {
      const callee = path.node.callee;

      // css({ ... }) call
      if (callee.type === 'Identifier' && callee.name === 'css') {
        const arg = path.node.arguments[0];
        if (arg && arg.type === 'ObjectExpression') {
          const result = processObjectExpression(arg, filePath, tokenMap);
          violations.push(...result.violations);
          totalProperties += result.totalProperties;
        }
      }
    },
  });

  return { violations, totalProperties };
}

function extractCSS(quasi: Node & { type: 'TemplateLiteral' }): string {
  let css = '';
  for (let i = 0; i < quasi.quasis.length; i++) {
    css += quasi.quasis[i].value.cooked ?? quasi.quasis[i].value.raw;
    if (i < quasi.expressions.length) {
      css += '/* __INTERPOLATION__ */';
    }
  }
  return css;
}

function processObjectExpression(
  obj: Node & { type: 'ObjectExpression' },
  filePath: string,
  tokenMap: TokenMap,
): EngineResult {
  const violations: Violation[] = [];
  let totalProperties = 0;

  for (const prop of obj.properties) {
    if (prop.type !== 'ObjectProperty') continue;

    const keyName = getKeyName(prop.key);
    if (!keyName || !CSS_STYLE_PROPS.has(keyName)) continue;

    const value = extractStaticValue(prop.value);
    if (value === null) continue;

    totalProperties++;

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

  return { violations, totalProperties };
}

function getKeyName(key: Node): string | null {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'StringLiteral') return key.value;
  return null;
}

function extractStaticValue(value: Node): string | null {
  if (value.type === 'StringLiteral') return value.value;
  if (value.type === 'NumericLiteral') return String(value.value);
  if (value.type === 'TemplateLiteral' && value.expressions.length === 0) {
    return value.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
  }
  return null;
}
