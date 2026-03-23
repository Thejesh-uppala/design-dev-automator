/**
 * AST Scanner Orchestrator — E3-S7
 *
 * Globs component files, dispatches to the correct engine(s), collects
 * violations, and writes results to the Score Store.
 */

import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { parse } from '@babel/parser';
import fg from 'fast-glob';
import type { ScanConfig } from '../config/schema.js';
import type { TokenMap } from '../tokens/types.js';
import type { Violation } from '../scoring/types.js';
import { ScoreStore } from '../scoring/store.js';
import { scanJSXStyles } from './engines/jsx-style.js';
import { scanCSSModule } from './engines/css-module.js';
import { scanStyledComponents } from './engines/styled-components.js';
import { scanEmotion } from './engines/emotion.js';
import { scanVanillaExtract } from './engines/vanilla-extract.js';

export interface ScanFileResult {
  violations: Violation[];
  totalProperties: number;
}

/**
 * Parse a JS/TS/JSX/TSX file into a Babel AST.
 */
function parseFile(source: string, filePath: string) {
  const plugins: Array<'jsx' | 'typescript' | 'decorators'> = ['jsx'];
  const ext = extname(filePath).toLowerCase();

  if (ext === '.ts' || ext === '.tsx') {
    plugins.push('typescript');
  }
  plugins.push('decorators');

  return parse(source, {
    sourceType: 'module',
    plugins,
    errorRecovery: true,
  });
}

/**
 * Check if source contains styled-components imports.
 */
function hasStyledComponentsImport(source: string): boolean {
  return /import\s+.*from\s+['"]styled-components['"]/.test(source);
}

/**
 * Check if source contains Emotion imports or css prop usage.
 */
function hasEmotionImport(source: string): boolean {
  return (
    /import\s+.*from\s+['"]@emotion\/(react|styled|css)['"]/.test(source) ||
    /\bcss\s*=\s*\{/.test(source)
  );
}

/**
 * Scan a single file for token violations.
 */
export function scanFile(
  filePath: string,
  source: string,
  tokenMap: TokenMap,
): ScanFileResult {
  const ext = extname(filePath).toLowerCase();
  const allViolations: Violation[] = [];
  let totalProperties = 0;

  // CSS Modules: .module.css, .module.scss
  if (filePath.includes('.module.css') || filePath.includes('.module.scss')) {
    const result = scanCSSModule(source, filePath, tokenMap);
    allViolations.push(...result.violations);
    totalProperties += result.totalProperties;
    return { violations: allViolations, totalProperties };
  }

  // vanilla-extract: .css.ts
  if (filePath.endsWith('.css.ts')) {
    const ast = parseFile(source, filePath);
    const result = scanVanillaExtract(ast, filePath, tokenMap);
    allViolations.push(...result.violations);
    totalProperties += result.totalProperties;
    return { violations: allViolations, totalProperties };
  }

  // JS/TS/JSX/TSX files
  if (['.tsx', '.jsx', '.ts', '.js'].includes(ext)) {
    const ast = parseFile(source, filePath);

    // Always run JSX style prop engine
    const jsxResult = scanJSXStyles(ast, filePath, tokenMap);
    allViolations.push(...jsxResult.violations);
    totalProperties += jsxResult.totalProperties;

    // styled-components engine if imported
    if (hasStyledComponentsImport(source)) {
      const scResult = scanStyledComponents(ast, filePath, tokenMap);
      allViolations.push(...scResult.violations);
      totalProperties += scResult.totalProperties;
    }

    // Emotion engine if imported
    if (hasEmotionImport(source)) {
      const emotionResult = scanEmotion(ast, filePath, tokenMap);
      allViolations.push(...emotionResult.violations);
      totalProperties += emotionResult.totalProperties;
    }
  }

  return { violations: allViolations, totalProperties };
}

/**
 * Scan all project files matching config. Write results to ScoreStore.
 *
 * @returns Total violation count across all files.
 */
export function scanAll(
  rootDir: string,
  scanConfig: ScanConfig,
  tokenMap: TokenMap,
  scoreStore: ScoreStore,
): number {
  const allowedExtensions = new Set(
    scanConfig.fileTypes.map((t) => t.startsWith('.') ? t : `.${t}`),
  );

  const files = fg.sync(scanConfig.include, {
    cwd: rootDir,
    ignore: scanConfig.exclude,
    onlyFiles: true,
    dot: false,
  });

  const filtered = files.filter((f) =>
    allowedExtensions.has(extname(f).toLowerCase()),
  );

  let totalViolations = 0;

  for (const file of filtered) {
    const absPath = resolve(rootDir, file);
    const source = readFileSync(absPath, 'utf-8');
    const { violations, totalProperties } = scanFile(file, source, tokenMap);

    scoreStore.setViolations(file, violations, totalProperties);
    totalViolations += violations.length;
  }

  console.log(
    `Scanned ${filtered.length} files. ${totalViolations} violations found.`,
  );

  return totalViolations;
}
