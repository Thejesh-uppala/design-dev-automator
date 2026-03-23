/**
 * CSS Modules Engine — E3-S3
 *
 * Detects violations in .module.css and .module.scss files using postcss.
 */

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

export interface EngineResult {
  violations: Violation[];
  totalProperties: number;
}

const SOURCE: ViolationSource = 'css-module';

/**
 * Scan a CSS/SCSS module file for token violations.
 */
export function scanCSSModule(
  fileContent: string,
  filePath: string,
  tokenMap: TokenMap,
): EngineResult {
  const violations: Violation[] = [];
  let totalProperties = 0;

  let root;
  try {
    root = postcss().process(fileContent, {
      syntax: postcssScss as postcss.Syntax,
      from: filePath,
    }).root;
  } catch {
    return { violations, totalProperties };
  }

  root.walkDecls((decl) => {
    const prop = decl.prop;

    // Skip SCSS variables and CSS custom properties
    if (prop.startsWith('$') || prop.startsWith('--')) return;

    if (!CSS_STYLE_PROPS_KEBAB.has(prop)) return;

    const rawValue = decl.value;

    // Skip SCSS variable references and CSS var()
    if (rawValue.startsWith('$') || rawValue.includes('var(')) return;

    // Multi-value properties: extract and check each segment
    const values = extractValues(rawValue);
    let hasMatchableValue = false;

    for (const val of values) {
      if (isViolation(val, prop, tokenMap)) {
        const tokens = findNearestToken(val, tokenMap);
        const tokenEntry = tokens.length > 0 ? tokenMap.tokens[tokens[0]] : null;

        violations.push({
          id: violationId(filePath, decl.source?.start?.line ?? 0, val),
          file: filePath,
          line: decl.source?.start?.line ?? 0,
          column: decl.source?.start?.column ?? 0,
          prop,
          found: val,
          type: violationTypeFromProp(prop),
          nearestToken: tokens[0] ?? '',
          figmaToken: tokenEntry?.cssVar ?? '',
          resolvedValue: tokenEntry?.resolvedValue ?? val,
          source: SOURCE,
          confidence: 'exact',
        });
      }

      // Count if value is a raw matchable value (not a keyword)
      if (/(?:#[0-9a-fA-F]|\d+px|\d+em|\d+rem|rgba?\(|hsla?\()/.test(val)) {
        hasMatchableValue = true;
      }
    }

    if (hasMatchableValue) {
      totalProperties++;
    }
  });

  return { violations, totalProperties };
}
