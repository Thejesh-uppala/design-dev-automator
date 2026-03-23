# Story 1.3: Internal Token Format + DTCG Converter

Status: review

## Story

As a developer,
I want an internal `TokenMap` data structure with a W3C DTCG JSON parser that resolves alias chains,
so that all downstream modules (AST scanner, scoring, dashboard) share one canonical token representation.

## Acceptance Criteria

1. `TokenMap` interface includes: `tokens` (keyed by path), `lookupByValue`, `lookupByCssVar`, `version`, `syncedAt`, `source`
2. `TokenEntry` includes: `resolvedValue`, `aliasChain`, `cssVar`, `type` (color | spacing | typography | border-radius | shadow)
3. `parseDTCG()` parses valid W3C DTCG JSON (`$value`, `$type`, `$description` fields)
4. Alias resolution handles 3+ levels deep: `A → B → C → #0050C0`
5. Cyclic alias (`A → B → A`) throws `CyclicAliasError` with the chain path
6. Max depth of 20 enforced — throws on deeper chains
7. `lookupByValue` maps resolved values to array of token paths: `{ "#0050C0": ["colors/brand/primary", "colors/blue/600"] }`
8. `lookupByCssVar` maps CSS variable names to token paths: `{ "--color-brand-primary": "colors/brand/primary" }`
9. CSS variable name derived from token path: `colors/brand/primary` → `--color-brand-primary` (slash → dash)

## Tasks / Subtasks

- [x] Task 1: Define TypeScript interfaces (AC: #1, #2)
  - [x] 1.1: Create `src/tokens/types.ts` with `TokenMap`, `TokenEntry`, `TokenType` types
- [x] Task 2: Implement alias chain resolver (AC: #4, #5, #6)
  - [x] 2.1: Create `src/tokens/resolver.ts` with `resolveAliasChain()`
  - [x] 2.2: Implement cyclic detection — throws `CyclicAliasError`
  - [x] 2.3: Enforce max depth of 20
- [x] Task 3: Implement DTCG converter (AC: #3, #7, #8, #9)
  - [x] 3.1: Create `src/tokens/converters/dtcg.ts` with `parseDTCG()`
  - [x] 3.2: Flatten nested DTCG JSON into token path keys (e.g., `colors/primary`)
  - [x] 3.3: Map DTCG `$type` to internal `TokenType`
  - [x] 3.4: Build `lookupByValue` reverse map
  - [x] 3.5: Build `lookupByCssVar` reverse map
  - [x] 3.6: Normalize hex values (`#fff` → `#ffffff`, lowercase)
- [x] Task 4: Write tests (AC: #1–#9)
  - [x] 4.1: Test simple token resolves and appears in lookupByValue
  - [x] 4.2: Test 2-level alias chain resolves correctly
  - [x] 4.3: Test 4-level alias chain — all tokens resolve to same value
  - [x] 4.4: Test cyclic alias throws CyclicAliasError
  - [x] 4.5: Test 21-level chain throws max depth error
  - [x] 4.6: Test `$type: "dimension"` maps to `spacing`
  - [x] 4.7: Test hex normalization (`#fff` → `#ffffff`)
  - [x] 4.8: Test CSS variable derivation (`colors/brand/primary` → `--colors-brand-primary`)
  - [x] 4.9: Test lookupByCssVar is populated correctly

## Dev Notes

### Architecture — Token Cache Structure (MANDATORY)

The `TokenMap` is the canonical in-memory representation used everywhere:

```json
{
  "version": "1",
  "syncedAt": "2026-03-20T10:00:00Z",
  "source": "dtcg",
  "tokens": {
    "colors/brand/primary": {
      "resolvedValue": "#0050c0",
      "aliasChain": ["colors/brand/primary", "colors/blue/600"],
      "cssVar": "--colors-brand-primary",
      "type": "color"
    }
  },
  "lookupByValue": {
    "#0050c0": ["colors/brand/primary", "colors/blue/600"]
  },
  "lookupByCssVar": {
    "--colors-brand-primary": "colors/brand/primary",
    "--colors-blue-600": "colors/blue/600"
  }
}
```

### Alias Resolution Algorithm (from architecture)

```
function resolve(key, tokenMap, chain = []):
  if key in chain: throw CyclicAliasError(chain)
  if chain.length >= 20: throw MaxDepthError
  token = tokenMap[key]
  if token.$value starts with '{':
    aliasKey = token.$value.replace(/^\{|\}$/g, '')  // strip braces
    return resolve(aliasKey, tokenMap, [...chain, key])
  return { value: token.$value, chain: [...chain, key] }
```

### DTCG JSON Format

W3C Design Token Community Group format. Tokens are nested objects. Leaf nodes have `$value`, `$type`, optional `$description`:

```json
{
  "colors": {
    "blue": {
      "600": { "$value": "#0050C0", "$type": "color" }
    },
    "brand": {
      "primary": { "$value": "{colors/blue/600}", "$type": "color" }
    }
  },
  "spacing": {
    "4": { "$value": "16px", "$type": "dimension" }
  }
}
```

Aliases use `{path/to/token}` syntax with `/` separators inside braces.

### DTCG `$type` → Internal `TokenType` Mapping

| DTCG `$type` | Internal `TokenType` |
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

### Hex Normalization Rules

- `#fff` → `#ffffff` (expand 3-digit)
- `#FFF` → `#ffffff` (lowercase)
- `#0050C0` → `#0050c0` (lowercase)
- Non-hex values (e.g., `16px`, `rgb(...)`) are stored as-is

### CSS Variable Derivation

Token path `colors/brand/primary` → CSS var `--colors-brand-primary`
- Replace `/` with `-`
- Prepend `--`

### Flattening Nested DTCG JSON

Walk the DTCG JSON recursively. A node is a token if it has `$value`. Build the path by joining ancestor keys with `/`:

```
{ colors: { brand: { primary: { $value: "..." } } } }
→ path = "colors/brand/primary"
```

### Existing Project State

```
pixelproof/
  src/cli/index.ts              # E1-S1 — DO NOT MODIFY
  src/config/schema.ts          # E1-S2 — DO NOT MODIFY
  src/config/defaults.ts        # E1-S2 — DO NOT MODIFY
  src/config/loader.ts          # E1-S2 — DO NOT MODIFY
```

### Files to Create

```
pixelproof/
  src/tokens/
    types.ts                    # TokenMap, TokenEntry, TokenType, CyclicAliasError
    resolver.ts                 # resolveAliasChain()
    converters/
      dtcg.ts                   # parseDTCG(json) → TokenMap
  src/tokens/__tests__/
    dtcg.test.ts                # All test cases
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Q3 — Token Resolution]
- [Source: _bmad-output/planning-artifacts/stories/epic-01-foundation.md#E1-S3]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- `TokenMap`, `TokenEntry`, `TokenType` interfaces matching architecture spec exactly
- `CyclicAliasError` and `MaxDepthError` custom error classes
- `resolveAliasChain()` — recursive resolver with cycle detection and max depth=20 enforcement
- `parseDTCG()` — flattens nested DTCG JSON, resolves all aliases, builds both lookup maps
- Hex normalization: 3-digit expansion + lowercase
- DTCG `$type` mapping: dimension→spacing, fontFamily/fontSize/fontWeight/lineHeight→typography, borderRadius→border-radius
- CSS var derivation: slash→dash with `--` prefix
- 13 new tests (37 total), zero regressions

### File List

- `pixelproof/src/tokens/types.ts` (new)
- `pixelproof/src/tokens/resolver.ts` (new)
- `pixelproof/src/tokens/converters/dtcg.ts` (new)
- `pixelproof/src/tokens/__tests__/dtcg.test.ts` (new)

### Change Log

- 2026-03-20: Story 1.3 implemented — TokenMap types, alias resolver with cycle/depth guards, DTCG converter with full lookup maps
