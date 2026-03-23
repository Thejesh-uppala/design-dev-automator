import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
} from 'node:fs';
import { resolve, join, extname } from 'node:path';
import type { TokenMap } from './types.js';
import type { TokensConfig } from '../config/schema.js';
import { detectTokenFormat } from './converters/detect.js';
import { parseDTCG } from './converters/dtcg.js';
import {
  parseStyleDictionaryCSS,
  parseStyleDictionaryJS,
} from './converters/style-dictionary.js';
import { parseTokenStudio } from './converters/token-studio.js';
import { writeCache } from './cache.js';

const TOKEN_EXTENSIONS = new Set(['.json', '.css', '.js', '.ts']);
const CACHE_DIR_NAME = '.pixelproof';
const GITIGNORE_ENTRY = '.pixelproof/';

/**
 * Create an empty TokenMap with zero tokens.
 */
function createEmptyTokenMap(source: string = 'local'): TokenMap {
  return {
    version: '1',
    syncedAt: new Date().toISOString(),
    source,
    tokens: {},
    lookupByValue: {},
    lookupByCssVar: {},
  };
}

/**
 * Merge source TokenMap into target (additive — token paths assumed unique).
 */
function mergeTokenMaps(target: TokenMap, source: TokenMap): void {
  Object.assign(target.tokens, source.tokens);

  for (const [value, paths] of Object.entries(source.lookupByValue)) {
    if (!target.lookupByValue[value]) {
      target.lookupByValue[value] = [];
    }
    for (const p of paths) {
      if (!target.lookupByValue[value].includes(p)) {
        target.lookupByValue[value].push(p);
      }
    }
  }

  Object.assign(target.lookupByCssVar, source.lookupByCssVar);
}

/**
 * Ensure `.pixelproof/` is listed in `.gitignore`.
 * Creates `.gitignore` if missing; appends if entry not present.
 */
function ensureGitignore(rootDir: string): void {
  const gitignorePath = resolve(rootDir, '.gitignore');

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, GITIGNORE_ENTRY + '\n', 'utf-8');
    return;
  }

  const content = readFileSync(gitignorePath, 'utf-8');
  if (content.split('\n').some((line) => line.trim() === GITIGNORE_ENTRY)) {
    return;
  }

  appendFileSync(gitignorePath, '\n' + GITIGNORE_ENTRY + '\n', 'utf-8');
}

/**
 * Convert a single token file to a TokenMap using the appropriate converter.
 * Returns null if format is unknown.
 */
function convertFile(
  filename: string,
  content: string,
): TokenMap | null {
  const format = detectTokenFormat(filename, content);

  switch (format) {
    case 'dtcg':
      return parseDTCG(JSON.parse(content));
    case 'style-dictionary-css':
      return parseStyleDictionaryCSS(content);
    case 'style-dictionary-js':
      return parseStyleDictionaryJS(JSON.parse(content));
    case 'token-studio':
      return parseTokenStudio(JSON.parse(content));
    default:
      return null;
  }
}

/**
 * Load token files from local directory, auto-detect format, merge, and cache.
 *
 * @param rootDir - Project root directory
 * @param tokensConfig - Tokens configuration (format + fallbackDir)
 * @returns Merged TokenMap from all token files
 */
export function loadLocalTokens(
  rootDir: string,
  tokensConfig: TokensConfig,
): TokenMap {
  const tokensDir = resolve(rootDir, tokensConfig.fallbackDir);
  const cacheDir = resolve(rootDir, CACHE_DIR_NAME);
  const merged = createEmptyTokenMap('local');

  // If tokens directory doesn't exist, return empty TokenMap
  if (!existsSync(tokensDir)) {
    ensureGitignore(rootDir);
    writeCache(cacheDir, merged);
    return merged;
  }

  // Scan for token files
  const files = readdirSync(tokensDir).filter((f) =>
    TOKEN_EXTENSIONS.has(extname(f).toLowerCase()),
  );

  for (const file of files) {
    const filePath = join(tokensDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const tokenMap = convertFile(file, content);

    if (tokenMap) {
      mergeTokenMaps(merged, tokenMap);
    }
  }

  // Ensure .pixelproof/ dir and .gitignore entry
  ensureGitignore(rootDir);
  writeCache(cacheDir, merged);

  return merged;
}
