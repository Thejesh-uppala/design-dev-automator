/**
 * vanilla-extract Engine — E3-S6
 *
 * Detects violations in .css.ts files:
 *   style({ color: '#6366f1' })
 *   globalStyle('.root', { color: '#6366f1' })
 *   recipe({ base: { color: '#6366f1' }, variants: { ... } })
 *   styleVariants({ primary: { color: '#6366f1' } })
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const traverse: (ast: t.Node, opts: import('@babel/traverse').TraverseOptions) => void =
  typeof (_traverse as any).default === 'function'
    ? (_traverse as any).default
    : _traverse as any;

export interface EngineResult {
  violations: Violation[];
  totalProperties: number;
}

const SOURCE: ViolationSource = 'vanilla-extract';

const VE_FUNCTIONS = new Set([
  'style', 'globalStyle', 'recipe', 'styleVariants',
  'fontFace', 'keyframes',
]);

/**
 * Scan a Babel AST for vanilla-extract violations.
 * Only processes .css.ts files.
 */
export function scanVanillaExtract(
  ast: Node,
  filePath: string,
  tokenMap: TokenMap,
): EngineResult {
  // Only process .css.ts files
  if (!filePath.endsWith('.css.ts')) {
    return { violations: [], totalProperties: 0 };
  }

  const violations: Violation[] = [];
  let totalProperties = 0;

  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const calleeName = getCalleeName(path.node.callee);
      if (!calleeName || !VE_FUNCTIONS.has(calleeName)) return;

      // globalStyle has style object as 2nd arg
      const argIndex = calleeName === 'globalStyle' ? 1 : 0;
      const arg = path.node.arguments[argIndex];
      if (!arg) return;

      if (arg.type === 'ObjectExpression') {
        if (calleeName === 'recipe') {
          // recipe({ base: {...}, variants: {...} })
          const result = processRecipe(arg, filePath, tokenMap);
          violations.push(...result.violations);
          totalProperties += result.totalProperties;
        } else if (calleeName === 'styleVariants') {
          // styleVariants({ primary: {...}, secondary: {...} })
          const result = processStyleVariants(arg, filePath, tokenMap);
          violations.push(...result.violations);
          totalProperties += result.totalProperties;
        } else {
          // style({ ... }), globalStyle('sel', { ... }), fontFace({ ... }), keyframes({ ... })
          const result = processStyleObject(arg, filePath, tokenMap);
          violations.push(...result.violations);
          totalProperties += result.totalProperties;
        }
      }
    },
  });

  return { violations, totalProperties };
}

function getCalleeName(callee: Node): string | null {
  if (callee.type === 'Identifier') return callee.name;
  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }
  return null;
}

/**
 * Process a style object, recursing into nested objects (selectors, etc.)
 */
function processStyleObject(
  obj: Node & { type: 'ObjectExpression' },
  filePath: string,
  tokenMap: TokenMap,
): EngineResult {
  const violations: Violation[] = [];
  let totalProperties = 0;

  for (const prop of obj.properties) {
    if (prop.type !== 'ObjectProperty') continue;

    const keyName = getKeyName(prop.key);
    if (!keyName) continue;

    // If value is an object, recurse (handles selectors, @media, etc.)
    if (prop.value.type === 'ObjectExpression') {
      const result = processStyleObject(prop.value, filePath, tokenMap);
      violations.push(...result.violations);
      totalProperties += result.totalProperties;
      continue;
    }

    if (!CSS_STYLE_PROPS.has(keyName)) continue;

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

/**
 * Process recipe({ base: {...}, variants: { variant: { value: {...} } } })
 */
function processRecipe(
  obj: Node & { type: 'ObjectExpression' },
  filePath: string,
  tokenMap: TokenMap,
): EngineResult {
  const violations: Violation[] = [];
  let totalProperties = 0;

  for (const prop of obj.properties) {
    if (prop.type !== 'ObjectProperty') continue;

    const keyName = getKeyName(prop.key);

    if (keyName === 'base' && prop.value.type === 'ObjectExpression') {
      const result = processStyleObject(prop.value, filePath, tokenMap);
      violations.push(...result.violations);
      totalProperties += result.totalProperties;
    } else if (keyName === 'variants' && prop.value.type === 'ObjectExpression') {
      // variants: { variant: { value: { ...styles } } }
      for (const variantGroup of prop.value.properties) {
        if (variantGroup.type !== 'ObjectProperty') continue;
        if (variantGroup.value.type !== 'ObjectExpression') continue;

        for (const variantValue of variantGroup.value.properties) {
          if (variantValue.type !== 'ObjectProperty') continue;
          if (variantValue.value.type === 'ObjectExpression') {
            const result = processStyleObject(variantValue.value, filePath, tokenMap);
            violations.push(...result.violations);
            totalProperties += result.totalProperties;
          }
        }
      }
    }
  }

  return { violations, totalProperties };
}

/**
 * Process styleVariants({ primary: {...}, secondary: {...} })
 */
function processStyleVariants(
  obj: Node & { type: 'ObjectExpression' },
  filePath: string,
  tokenMap: TokenMap,
): EngineResult {
  const violations: Violation[] = [];
  let totalProperties = 0;

  for (const prop of obj.properties) {
    if (prop.type !== 'ObjectProperty') continue;
    if (prop.value.type !== 'ObjectExpression') continue;

    const result = processStyleObject(prop.value, filePath, tokenMap);
    violations.push(...result.violations);
    totalProperties += result.totalProperties;
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
