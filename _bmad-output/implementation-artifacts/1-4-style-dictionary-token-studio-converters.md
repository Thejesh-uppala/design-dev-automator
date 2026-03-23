# Story 1.4: Style Dictionary + Token Studio Converters

Status: review

## Story

As a developer,
I want converters for Style Dictionary (CSS + JS) and Token Studio formats,
so that local `tokens/` directories using any supported format produce the same `TokenMap` as the DTCG converter.

## Acceptance Criteria

1. **Style Dictionary CSS custom properties:** Parses CSS strings containing `--token-name: value;` declarations. Extracts variable name + value. Builds `lookupByValue` and `lookupByCssVar`.
2. **Style Dictionary JS/TS export:** Parses nested object structures with `value` at leaf nodes (same shape as `module.exports = {...}` or `export default {...}` output). Resolves to flat key-value pairs.
3. **Token Studio JSON:** Parses Token Studio's JSON export format (nested object with `value`, `type`, `description` fields — no `$` prefix). Dot-notation aliases (`{colors.blue.600}`) normalized to slash notation before resolution. Runs through the same alias resolver from E1-S3.
4. All three converters produce identical `TokenMap` structure as DTCG converter
5. **Format auto-detection:** Given a filename and content string, detect whether it's DTCG, Style Dictionary CSS, Style Dictionary JS, or Token Studio based on content/extension

## Tasks / Subtasks

- [x] Task 1: Implement Style Dictionary CSS converter (AC: #1, #4)
  - [x] 1.1: Create `src/tokens/converters/style-dictionary.ts` with `parseStyleDictionaryCSS(css, source?) → TokenMap`
  - [x] 1.2: Parse CSS custom property declarations (`--name: value;`) from CSS string — handle `:root {}` blocks and bare declarations
  - [x] 1.3: Derive token path from CSS var name (strip `--` prefix): `--color-primary` → path `color-primary`
  - [x] 1.4: Infer `TokenType` from value pattern (hex → `color`, px/rem/em → `spacing`, fallback `color`)
  - [x] 1.5: Build `lookupByValue` and `lookupByCssVar` maps
  - [x] 1.6: Apply hex normalization (reuse `normalizeValue` from `converters/dtcg.ts`)
- [x] Task 2: Implement Style Dictionary JS converter (AC: #2, #4)
  - [x] 2.1: Add `parseStyleDictionaryJS(obj, source?) → TokenMap` to `style-dictionary.ts`
  - [x] 2.2: Flatten nested object — leaf nodes have `value` property (no `$` prefix)
  - [x] 2.3: Build token path from nesting: `{ color: { primary: { value: "#0050C0" } } }` → path `color/primary`
  - [x] 2.4: Infer `TokenType` from `type` property if present, else from value pattern
  - [x] 2.5: Build both lookup maps, apply hex normalization
- [x] Task 3: Implement Token Studio converter (AC: #3, #4)
  - [x] 3.1: Create `src/tokens/converters/token-studio.ts` with `parseTokenStudio(json, source?) → TokenMap`
  - [x] 3.2: Flatten nested JSON — leaf nodes have `value` (not `$value`), `type`, `description`
  - [x] 3.3: Normalize dot-notation aliases to slash: `{colors.blue.600}` → `{colors/blue/600}` before resolution
  - [x] 3.4: Reuse `resolveAliasChain()` from `resolver.ts` (requires building flat token map with `$value` field for resolver compatibility)
  - [x] 3.5: Map `type` field to internal `TokenType` using same mapping as DTCG
  - [x] 3.6: Build both lookup maps, apply hex normalization
- [x] Task 4: Implement format auto-detection (AC: #5)
  - [x] 4.1: Create `src/tokens/converters/detect.ts` with `detectTokenFormat(filename, content) → TokenFormat`
  - [x] 4.2: Detection rules: `.css` → `style-dictionary-css`; `.js`/`.ts` → `style-dictionary-js`; `.json` with `$value` → `dtcg`; `.json` with `value` (no `$`) → `token-studio`
  - [x] 4.3: Export `TokenFormat` type union
- [x] Task 5: Write tests (AC: #1–#5)
  - [x] 5.1: Test SD CSS — parses `:root { --color-primary: #0050C0; --spacing-4: 16px; }` correctly
  - [x] 5.2: Test SD CSS — lookupByValue and lookupByCssVar populated
  - [x] 5.3: Test SD CSS — hex normalization applied
  - [x] 5.4: Test SD CSS — value type inference (hex → color, px → spacing)
  - [x] 5.5: Test SD JS — parses nested object with `value` fields
  - [x] 5.6: Test SD JS — flattens to correct paths (`color/primary`)
  - [x] 5.7: Test SD JS — produces identical TokenMap structure as other converters
  - [x] 5.8: Test Token Studio — parses nested object with `value`/`type` fields
  - [x] 5.9: Test Token Studio — dot-notation alias `{colors.blue.600}` resolves correctly
  - [x] 5.10: Test Token Studio — multi-level alias chain resolves
  - [x] 5.11: Test Token Studio — cyclic alias throws CyclicAliasError
  - [x] 5.12: Test format detection — `.css` file → `style-dictionary-css`
  - [x] 5.13: Test format detection — `.json` with `$value` → `dtcg`
  - [x] 5.14: Test format detection — `.json` with `value` (no `$`) → `token-studio`
  - [x] 5.15: Test format detection — `.js`/`.ts` → `style-dictionary-js`

## Dev Notes

### Existing Project State — DO NOT MODIFY these files

```
pixelproof/
  src/cli/index.ts              # E1-S1
  src/config/schema.ts          # E1-S2
  src/config/defaults.ts        # E1-S2
  src/config/loader.ts          # E1-S2
  src/tokens/types.ts           # E1-S3
  src/tokens/resolver.ts        # E1-S3
  src/tokens/converters/dtcg.ts # E1-S3
```

### Files to Create

```
pixelproof/
  src/tokens/converters/
    style-dictionary.ts         # parseStyleDictionaryCSS(), parseStyleDictionaryJS()
    token-studio.ts             # parseTokenStudio()
    detect.ts                   # detectTokenFormat()
  src/tokens/__tests__/
    style-dictionary.test.ts    # SD CSS + JS tests
    token-studio.test.ts        # Token Studio tests
    detect.test.ts              # Format detection tests
```

### Shared Types (from `src/tokens/types.ts` — already exists)

```typescript
export type TokenType = 'color' | 'spacing' | 'typography' | 'border-radius' | 'shadow';

export interface TokenEntry {
  resolvedValue: string;
  aliasChain: string[];
  cssVar: string;
  type: TokenType;
}

export interface TokenMap {
  version: string;
  syncedAt: string;
  source: string;
  tokens: Record<string, TokenEntry>;
  lookupByValue: Record<string, string[]>;
  lookupByCssVar: Record<string, string>;
}

export class CyclicAliasError extends Error {
  public chain: string[];
  constructor(chain: string[]) {
    super(`Cyclic alias detected: ${chain.join(' → ')}`);
    this.name = 'CyclicAliasError';
    this.chain = chain;
  }
}

export class MaxDepthError extends Error {
  constructor(depth: number) {
    super(`Alias chain exceeds maximum depth of ${depth}`);
    this.name = 'MaxDepthError';
  }
}
```

### Shared Resolver (from `src/tokens/resolver.ts` — already exists)

```typescript
import { CyclicAliasError, MaxDepthError } from './types.js';

const MAX_DEPTH = 20;

interface RawToken {
  $value: string;
  $type?: string;
}

export interface ResolveResult {
  value: string;
  chain: string[];
}

export function resolveAliasChain(
  key: string,
  flatTokens: Record<string, RawToken>,
  chain: string[] = [],
): ResolveResult {
  if (chain.includes(key)) {
    throw new CyclicAliasError([...chain, key]);
  }
  if (chain.length >= MAX_DEPTH) {
    throw new MaxDepthError(MAX_DEPTH);
  }
  const token = flatTokens[key];
  if (!token) {
    throw new Error(`Token not found: ${key}`);
  }
  const value = token.$value;
  if (value.startsWith('{') && value.endsWith('}')) {
    const aliasKey = value.slice(1, -1);
    return resolveAliasChain(aliasKey, flatTokens, [...chain, key]);
  }
  return { value, chain: [...chain, key] };
}
```

**IMPORTANT:** The resolver expects `$value` field. Token Studio uses `value` (no `$`). When building the flat token map for Token Studio, you must map `value` → `$value` for resolver compatibility.

### Shared Utilities (from `src/tokens/converters/dtcg.ts` — reuse these)

```typescript
// Import from dtcg.ts:
import { normalizeValue, pathToCssVar } from './dtcg.js';

// normalizeValue: #fff → #ffffff, #FFF → #ffffff, #0050C0 → #0050c0, non-hex unchanged
// pathToCssVar: colors/brand/primary → --colors-brand-primary
```

### DTCG `$type` → Internal `TokenType` Mapping (reuse for Token Studio)

| DTCG/TS `type` | Internal `TokenType` |
|---|---|
| `color` | `color` |
| `dimension` | `spacing` |
| `fontFamily` | `typography` |
| `fontSize` | `typography` |
| `fontWeight` | `typography` |
| `lineHeight` | `typography` |
| `borderRadius` | `border-radius` |
| `shadow` | `shadow` |
| (unknown) | `color` (fallback) |

### Style Dictionary CSS Format

CSS custom properties output. Tokens are flat `--name: value;` declarations, typically inside `:root {}`:

```css
:root {
  --color-primary: #0050C0;
  --color-secondary: #6B7280;
  --spacing-4: 16px;
  --spacing-8: 32px;
  --font-size-base: 16px;
  --border-radius-sm: 4px;
}
```

**Parsing rules:**
- Extract all CSS custom property declarations: `--name: value;`
- Token path = CSS var name without `--` prefix: `--color-primary` → `color-primary`
- CSS var = the full `--color-primary` (stored as-is)
- No alias resolution needed — SD CSS output is already fully resolved
- Alias chain = `[path]` (single element — no aliases in CSS output)
- Type inference from value (no `$type` available in CSS):
  - Value matches `/^#[0-9a-fA-F]{3,6}$/` → `color`
  - Value matches `/^rgb/` or `/^hsl/` → `color`
  - Value matches `/^\d+(\.\d+)?(px|rem|em)$/` → `spacing`
  - Otherwise → `color` (fallback)

### Style Dictionary JS Format

Nested object with `value` at leaf nodes. This is the parsed result of a `module.exports = {...}` or `export default {...}` file:

```javascript
// The converter receives the already-parsed object, not raw JS source
{
  color: {
    primary: { value: "#0050C0" },
    secondary: { value: "#6B7280" }
  },
  spacing: {
    "4": { value: "16px" },
    "8": { value: "32px" }
  }
}
```

**Parsing rules:**
- Flatten nested object recursively — a node is a token if it has a `value` property (string)
- Build path by joining ancestor keys with `/`: `color/primary`
- Optional `type` field for type mapping; if absent, infer from value pattern (same as CSS)
- No alias resolution — SD JS output is already resolved
- Alias chain = `[path]` (single element)

### Token Studio JSON Format

Similar to DTCG but uses `value`/`type`/`description` (no `$` prefix) and dot-notation aliases:

```json
{
  "colors": {
    "blue": {
      "600": { "value": "#0050C0", "type": "color" }
    },
    "brand": {
      "primary": { "value": "{colors.blue.600}", "type": "color" }
    }
  },
  "spacing": {
    "4": { "value": "16px", "type": "dimension" }
  }
}
```

**Key differences from DTCG:**
- Fields: `value` instead of `$value`, `type` instead of `$type`, `description` instead of `$description`
- Aliases use dot notation: `{colors.blue.600}` (dots between segments, not slashes)
- Path separators in the JSON nesting use the same slash convention as DTCG: `colors/blue/600`

**Parsing rules:**
- Flatten nested JSON — a node is a token if it has a `value` property (string)
- Build path from nesting: `colors/brand/primary`
- **Normalize alias references:** Replace dots with slashes inside `{...}`: `{colors.blue.600}` → `{colors/blue/600}`
- Build flat token map with `$value` field (mapped from `value`) for resolver compatibility
- Run through `resolveAliasChain()` for alias resolution
- Map `type` to `TokenType` using same mapping table as DTCG
- Apply hex normalization via `normalizeValue()`

### Format Auto-Detection Rules

| Condition | Detected Format |
|---|---|
| Filename ends with `.css` | `style-dictionary-css` |
| Filename ends with `.js` or `.ts` | `style-dictionary-js` |
| Filename ends with `.json` AND content contains `"$value"` | `dtcg` |
| Filename ends with `.json` AND content contains `"value"` (no `$`) | `token-studio` |
| None of the above | `unknown` |

```typescript
export type TokenFormat = 'dtcg' | 'style-dictionary-css' | 'style-dictionary-js' | 'token-studio' | 'unknown';
```

### CSS Variable Derivation (same as E1-S3)

- For SD CSS: CSS var is the original `--name` as-is; token path = name without `--`
- For SD JS: Token path `color/primary` → CSS var `--color-primary` (slash → dash, prepend `--`)
- For Token Studio: Same as DTCG — path `colors/brand/primary` → `--colors-brand-primary`

### ES Modules

Project uses `"type": "module"`. All imports must use `.js` extension:
```typescript
import { normalizeValue, pathToCssVar } from './dtcg.js';
import { resolveAliasChain } from '../resolver.js';
import type { TokenMap, TokenType } from '../types.js';
```

### Testing Framework

Vitest. Run with `npx vitest run` from `pixelproof/` directory.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- `parseStyleDictionaryCSS()` — regex-based CSS custom property parser, extracts `--name: value;` declarations, infers TokenType from value patterns
- `parseStyleDictionaryJS()` — flattens nested SD JS objects with `value` leaf nodes, builds token paths from nesting
- `inferTypeFromValue()` — shared type inference: hex/rgb/hsl → color, px/rem/em → spacing, fallback color
- `parseTokenStudio()` — flattens Token Studio JSON (`value`/`type` fields, no `$` prefix), normalizes dot-notation aliases to slash before resolver
- Token Studio reuses `resolveAliasChain()` from E1-S3 by mapping `value` → `$value` for compatibility
- Token Studio reuses `DTCG_TYPE_MAP` (exported from dtcg.ts) for type mapping
- `detectTokenFormat()` — filename extension + content-based format detection
- `TokenFormat` type union exported: `'dtcg' | 'style-dictionary-css' | 'style-dictionary-js' | 'token-studio' | 'unknown'`
- All converters produce identical `TokenMap` structure with `lookupByValue` and `lookupByCssVar`
- 32 new tests (69 total), zero regressions

### File List

- `pixelproof/src/tokens/converters/style-dictionary.ts` (new)
- `pixelproof/src/tokens/converters/token-studio.ts` (new)
- `pixelproof/src/tokens/converters/detect.ts` (new)
- `pixelproof/src/tokens/converters/dtcg.ts` (modified — exported `DTCG_TYPE_MAP`)
- `pixelproof/src/tokens/__tests__/style-dictionary.test.ts` (new)
- `pixelproof/src/tokens/__tests__/token-studio.test.ts` (new)
- `pixelproof/src/tokens/__tests__/detect.test.ts` (new)

### Change Log

- 2026-03-20: Story 1.4 implemented — Style Dictionary CSS/JS converters, Token Studio converter with dot-alias normalization, format auto-detection
