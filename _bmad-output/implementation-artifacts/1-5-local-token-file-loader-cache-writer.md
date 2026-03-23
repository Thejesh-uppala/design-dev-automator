# Story 1.5: Local Token File Loader + Cache Writer

Status: review

## Story

As a developer,
I want PixelProof to read token files from the local `tokens/` directory, auto-detect their format, run the appropriate converter, and cache the result to `.pixelproof/token-cache.json`,
so that the AST scanner and dashboard have a fresh, unified token map without requiring Figma connectivity.

## Acceptance Criteria

1. Scans `tokens.fallbackDir` (default: `tokens/`) for token files (`.json`, `.css`, `.js`, `.ts`)
2. Auto-detects format per file using `detectTokenFormat()` from E1-S4
3. Merges tokens from multiple files into a single `TokenMap` (additive — token paths are unique across files)
4. Writes merged `TokenMap` to `.pixelproof/token-cache.json`
5. Creates `.pixelproof/` directory if it doesn't exist
6. On first run: appends `.pixelproof/` to `.gitignore` (creates `.gitignore` if missing, appends if not already present)
7. `readCache(cacheDir)` reads and returns existing `token-cache.json`, or `null` if missing
8. `isCacheFresh(tokenMap, syncTTL)` compares `syncedAt` timestamp against TTL — returns boolean
9. `writeCache(cacheDir, tokenMap)` writes JSON with current `syncedAt` and `version: "1"`
10. Empty `tokens/` directory → empty `TokenMap` with zero tokens (not an error)

## Tasks / Subtasks

- [x] Task 1: Implement cache module (AC: #7, #8, #9)
  - [x] 1.1: Create `src/tokens/cache.ts` with `readCache(cacheDir)`, `writeCache(cacheDir, tokenMap)`, `isCacheFresh(tokenMap, syncTTL)`
  - [x] 1.2: `readCache` returns parsed `TokenMap` or `null` if file doesn't exist
  - [x] 1.3: `writeCache` serializes TokenMap to JSON, writes to `{cacheDir}/token-cache.json`
  - [x] 1.4: `isCacheFresh` compares `Date.now()` against `syncedAt + syncTTL*1000` — returns boolean
- [x] Task 2: Implement token loader (AC: #1, #2, #3, #4, #5, #6, #10)
  - [x] 2.1: Create `src/tokens/loader.ts` with `loadLocalTokens(rootDir, config)`
  - [x] 2.2: Scan `tokens.fallbackDir` for files with extensions `.json`, `.css`, `.js`, `.ts`
  - [x] 2.3: Auto-detect format per file using `detectTokenFormat()`
  - [x] 2.4: Run appropriate converter based on detected format (DTCG, SD CSS, SD JS, Token Studio)
  - [x] 2.5: Merge tokens from multiple files into a single `TokenMap` (additive merge)
  - [x] 2.6: Ensure `.pixelproof/` directory exists (create if missing)
  - [x] 2.7: Ensure `.pixelproof/` is in `.gitignore` (create/append as needed)
  - [x] 2.8: Write merged `TokenMap` to cache via `writeCache()`
  - [x] 2.9: Handle missing `tokens/` directory gracefully — return empty TokenMap, no error
- [x] Task 3: Write tests (AC: #1–#10)
  - [x] 3.1: Test `writeCache` + `readCache` round-trip
  - [x] 3.2: Test `readCache` returns null for missing cache file
  - [x] 3.3: Test `isCacheFresh` returns true when within TTL
  - [x] 3.4: Test `isCacheFresh` returns false when expired
  - [x] 3.5: Test `loadLocalTokens` with DTCG JSON + SD CSS files — merged TokenMap
  - [x] 3.6: Test `loadLocalTokens` with missing tokens dir — empty TokenMap, no error
  - [x] 3.7: Test `.pixelproof/` directory created automatically
  - [x] 3.8: Test `.gitignore` created with `.pixelproof/` when missing
  - [x] 3.9: Test `.gitignore` appended when `.pixelproof/` not present
  - [x] 3.10: Test `.gitignore` not duplicated when `.pixelproof/` already present
  - [x] 3.11: Test empty tokens directory → empty TokenMap

## Dev Notes

### Existing Project State — DO NOT MODIFY these files

```
pixelproof/
  src/cli/index.ts                          # E1-S1
  src/config/schema.ts                      # E1-S2
  src/config/defaults.ts                    # E1-S2
  src/config/loader.ts                      # E1-S2
  src/tokens/types.ts                       # E1-S3
  src/tokens/resolver.ts                    # E1-S3
  src/tokens/converters/dtcg.ts             # E1-S3 (DTCG_TYPE_MAP exported in S4)
  src/tokens/converters/style-dictionary.ts # E1-S4
  src/tokens/converters/token-studio.ts     # E1-S4
  src/tokens/converters/detect.ts           # E1-S4
```

### Files to Create

```
pixelproof/
  src/tokens/
    cache.ts                # readCache(), writeCache(), isCacheFresh()
    loader.ts               # loadLocalTokens()
  src/tokens/__tests__/
    cache.test.ts           # Cache round-trip, freshness tests
    loader.test.ts          # Loader integration tests with temp dirs
```

### TokenMap Interface (from `src/tokens/types.ts`)

```typescript
export interface TokenMap {
  version: string;
  syncedAt: string;
  source: string;
  tokens: Record<string, TokenEntry>;
  lookupByValue: Record<string, string[]>;
  lookupByCssVar: Record<string, string>;
}

export interface TokenEntry {
  resolvedValue: string;
  aliasChain: string[];
  cssVar: string;
  type: TokenType;
}

export type TokenType = 'color' | 'spacing' | 'typography' | 'border-radius' | 'shadow';
```

### Config Interfaces (from `src/config/schema.ts`)

```typescript
export interface TokensConfig {
  format: 'dtcg' | 'style-dictionary' | 'token-studio';
  fallbackDir: string;  // default: 'tokens/'
}

export interface PixelProofConfig {
  figma?: FigmaConfig;
  scan: ScanConfig;
  tokens: TokensConfig;
  dashboard: DashboardConfig;
  render: RenderConfig;
}
```

### Available Converters (from E1-S3 and E1-S4)

```typescript
// DTCG — from src/tokens/converters/dtcg.ts
import { parseDTCG } from './converters/dtcg.js';
// parseDTCG(json: Record<string, unknown>, source?: string): TokenMap

// Style Dictionary CSS — from src/tokens/converters/style-dictionary.ts
import { parseStyleDictionaryCSS, parseStyleDictionaryJS } from './converters/style-dictionary.js';
// parseStyleDictionaryCSS(css: string, source?: string): TokenMap
// parseStyleDictionaryJS(obj: Record<string, unknown>, source?: string): TokenMap

// Token Studio — from src/tokens/converters/token-studio.ts
import { parseTokenStudio } from './converters/token-studio.js';
// parseTokenStudio(json: Record<string, unknown>, source?: string): TokenMap

// Format detection — from src/tokens/converters/detect.ts
import { detectTokenFormat } from './converters/detect.js';
// detectTokenFormat(filename: string, content: string): TokenFormat
// type TokenFormat = 'dtcg' | 'style-dictionary-css' | 'style-dictionary-js' | 'token-studio' | 'unknown';
```

### Cache Module Design

**`cache.ts` exports:**

```typescript
// Read cached token map from disk. Returns null if file doesn't exist.
export function readCache(cacheDir: string): TokenMap | null;

// Write token map to cache file. Creates directory if needed.
export function writeCache(cacheDir: string, tokenMap: TokenMap): void;

// Check if cached token map is still fresh based on syncTTL (seconds).
export function isCacheFresh(tokenMap: TokenMap, syncTTL: number): boolean;
```

- Cache file path: `{cacheDir}/token-cache.json`
- `cacheDir` is typically `.pixelproof/` relative to project root
- `isCacheFresh` formula: `(Date.now() - Date.parse(tokenMap.syncedAt)) < syncTTL * 1000`
- All I/O is synchronous (`readFileSync`, `writeFileSync`, `mkdirSync`) — this runs at startup, not in a hot path

### Loader Module Design

**`loader.ts` exports:**

```typescript
// Load token files from local directory, auto-detect format, merge, and cache.
export function loadLocalTokens(rootDir: string, tokensConfig: TokensConfig): TokenMap;
```

**Algorithm:**

1. Resolve `tokensDir = path.resolve(rootDir, tokensConfig.fallbackDir)`
2. If `tokensDir` doesn't exist → return empty TokenMap (no error)
3. List files in `tokensDir` matching extensions: `.json`, `.css`, `.js`, `.ts`
4. For each file:
   a. Read file content as UTF-8
   b. `detectTokenFormat(filename, content)` → format
   c. Based on format:
      - `dtcg` → `parseDTCG(JSON.parse(content))`
      - `style-dictionary-css` → `parseStyleDictionaryCSS(content)`
      - `style-dictionary-js` → `parseStyleDictionaryJS(JSON.parse(content))` (assumes JSON-compatible object)
      - `token-studio` → `parseTokenStudio(JSON.parse(content))`
      - `unknown` → skip file
   d. Merge result into combined TokenMap
5. Ensure `.pixelproof/` dir exists
6. Ensure `.pixelproof/` is in `.gitignore`
7. Write merged TokenMap to cache
8. Return merged TokenMap

**Merging TokenMaps:**

```typescript
function mergeTokenMaps(target: TokenMap, source: TokenMap): void {
  // Additive merge — copy all tokens, lookupByValue entries, lookupByCssVar entries
  Object.assign(target.tokens, source.tokens);
  for (const [value, paths] of Object.entries(source.lookupByValue)) {
    if (!target.lookupByValue[value]) target.lookupByValue[value] = [];
    for (const p of paths) {
      if (!target.lookupByValue[value].includes(p)) target.lookupByValue[value].push(p);
    }
  }
  Object.assign(target.lookupByCssVar, source.lookupByCssVar);
}
```

### Gitignore Handling

```typescript
function ensureGitignore(rootDir: string): void {
  const gitignorePath = path.resolve(rootDir, '.gitignore');
  const entry = '.pixelproof/';

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, entry + '\n', 'utf-8');
    return;
  }

  const content = readFileSync(gitignorePath, 'utf-8');
  if (content.split('\n').some(line => line.trim() === entry)) return;

  appendFileSync(gitignorePath, '\n' + entry + '\n', 'utf-8');
}
```

### Empty TokenMap Factory

```typescript
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
```

### Testing Pattern — Temp Directories

Use Node.js `mkdtempSync` for isolated test directories (same pattern as E1-S2 config tests):

```typescript
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'pixelproof-test-'));
```

### ES Modules

Project uses `"type": "module"`. All imports must use `.js` extension:
```typescript
import { readCache, writeCache, isCacheFresh } from './cache.js';
import { detectTokenFormat } from './converters/detect.js';
import type { TokenMap } from './types.js';
```

### Testing Framework

Vitest. Run with `npx vitest run` from `pixelproof/` directory.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- `readCache()` — reads `token-cache.json` from cache dir, returns `TokenMap | null`
- `writeCache()` — serializes TokenMap to JSON, creates dir recursively if needed
- `isCacheFresh()` — compares `syncedAt` timestamp against TTL in seconds, handles invalid dates
- `loadLocalTokens()` — scans fallbackDir for token files, auto-detects format, runs converters, merges additive, writes cache
- Additive `mergeTokenMaps()` — copies tokens, merges lookupByValue arrays, copies lookupByCssVar
- `ensureGitignore()` — creates or appends `.pixelproof/` to `.gitignore`, skips if already present
- Missing tokens dir returns empty TokenMap (no error)
- Supports custom `fallbackDir` from config
- Unknown format files silently skipped
- 16 new tests (85 total), zero regressions

### File List

- `pixelproof/src/tokens/cache.ts` (new)
- `pixelproof/src/tokens/loader.ts` (new)
- `pixelproof/src/tokens/__tests__/cache.test.ts` (new)
- `pixelproof/src/tokens/__tests__/loader.test.ts` (new)

### Change Log

- 2026-03-20: Story 1.5 implemented — cache read/write/freshness, local token loader with format auto-detection, gitignore management
