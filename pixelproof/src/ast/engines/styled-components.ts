/**
 * styled-components Engine — E3-S4
 *
 * Detects violations in styled-components template literals:
 *   styled.button`color: #6366f1;`
 *   styled(BaseButton)`...`
 *   css`...`
 */

import type { Node } from '@babel/types';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import postcss from 'postcss';
import postcssScss from 'postcss-scss';
import type { TokenMap } from '../../tokens/types.js';
import type { Violation, ViolationSource } from '../../scoring/types.js';
import { violationId } from '../../scoring/types.js';
import {
  CSS_STYLE_PROPS_KEBAB,
  isViolation,
  findNearestToken,
  violationTypeFromProp,
  extractValues,
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

const SOURCE: ViolationSource = 'styled-components';

/**
 * Check if a TaggedTemplateExpression tag matches styled-components patterns.
 */
function isStyledTag(tag: Node): boolean {
  // styled.button, styled.div, etc.
  if (
    tag.type === 'MemberExpression' &&
    tag.object.type === 'Identifier' &&
    tag.object.name === 'styled'
  ) {
    return true;
  }
  // styled(Component)
  if (
    tag.type === 'CallExpression' &&
    tag.callee.type === 'Identifier' &&
    tag.callee.name === 'styled'
  ) {
    return true;
  }
  // css tagged template
  if (tag.type === 'Identifier' && tag.name === 'css') {
    return true;
  }
  return false;
}

/**
 * Extract CSS string from a TemplateLiteral, replacing interpolations with placeholders.
 */
function extractCSS(quasi: Node & { type: 'TemplateLiteral' }): string {
  let css = '';
  for (let i = 0; i < quasi.quasis.length; i++) {
    css += quasi.quasis[i].value.cooked ?? quasi.quasis[i].value.raw;
    if (i < quasi.expressions.length) {
      // Replace interpolation with a placeholder that won't match any CSS property
      css += '/* __INTERPOLATION__ */';
    }
  }
  return css;
}

/**
 * Scan a Babel AST for styled-components violations.
 */
export function scanStyledComponents(
  ast: Node,
  filePath: string,
  tokenMap: TokenMap,
): EngineResult {
  const violations: Violation[] = [];
  let totalProperties = 0;

  traverse(ast, {
    TaggedTemplateExpression(path: NodePath<t.TaggedTemplateExpression>) {
      if (!isStyledTag(path.node.tag)) return;

      const css = extractCSS(path.node.quasi);
      if (!css.trim()) return;

      const templateStartLine = path.node.quasi.loc?.start.line ?? 0;

      const result = parseCSSAndCheck(
        css,
        filePath,
        tokenMap,
        templateStartLine,
        SOURCE,
      );

      violations.push(...result.violations);
      totalProperties += result.totalProperties;
    },
  });

  return { violations, totalProperties };
}

/**
 * Parse CSS string with postcss and check declarations for violations.
 * Shared by styled-components and Emotion template literal engines.
 */
export function parseCSSAndCheck(
  css: string,
  filePath: string,
  tokenMap: TokenMap,
  lineOffset: number,
  source: ViolationSource,
): EngineResult {
  const violations: Violation[] = [];
  let totalProperties = 0;

  let root;
  try {
    root = postcss().process(css, {
      syntax: postcssScss as postcss.Syntax,
      from: filePath,
    }).root;
  } catch {
    return { violations, totalProperties };
  }

  root.walkDecls((decl) => {
    const prop = decl.prop;
    if (prop.startsWith('--') || prop.startsWith('$')) return;
    if (!CSS_STYLE_PROPS_KEBAB.has(prop)) return;

    const rawValue = decl.value;
    if (rawValue.includes('var(') || rawValue.startsWith('$')) return;
    if (rawValue.includes('__INTERPOLATION__')) return;

    const values = extractValues(rawValue);
    let hasMatchableValue = false;

    for (const val of values) {
      if (isViolation(val, prop, tokenMap)) {
        const tokens = findNearestToken(val, tokenMap);
        const tokenEntry = tokens.length > 0 ? tokenMap.tokens[tokens[0]] : null;
        const line = lineOffset + (decl.source?.start?.line ?? 1) - 1;

        violations.push({
          id: violationId(filePath, line, val),
          file: filePath,
          line,
          column: decl.source?.start?.column ?? 0,
          prop,
          found: val,
          type: violationTypeFromProp(prop),
          nearestToken: tokens[0] ?? '',
          figmaToken: tokenEntry?.cssVar ?? '',
          resolvedValue: tokenEntry?.resolvedValue ?? val,
          source,
          confidence: 'exact',
        });
      }

      if (/(?:#[0-9a-fA-F]|\d+px|\d+em|\d+rem|rgba?\(|hsla?\()/.test(val)) {
        hasMatchableValue = true;
      }
    }

    if (hasMatchableValue) totalProperties++;
  });

  return { violations, totalProperties };
}
