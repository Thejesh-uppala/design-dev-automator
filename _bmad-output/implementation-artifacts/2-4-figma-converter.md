# Story 2.4: Figma Variable → Internal Token Format Converter

Status: review

## Story

As a developer,
I want PixelProof to convert raw Figma variable data into the internal TokenMap format,
so that downstream consumers get the same structure regardless of whether tokens came from Figma, DTCG, or other sources.

## Acceptance Criteria

1. Converts Figma variable collections → flat token entries keyed by path
2. Resolves Figma variable aliases (by variable ID, following chains)
3. Maps Figma variable types to internal types: `COLOR` → `color`, `FLOAT` → `spacing` (contextual), `STRING` → `typography` (contextual)
4. Builds `lookupByValue` and `lookupByCssVar` maps
5. Handles multi-mode variables: uses the mode matching `render.theme` config. Default: first mode
6. Normalizes hex values: `#FFF` → `#ffffff`, RGBA → hex when alpha = 1
7. Produces identical `TokenMap` structure to DTCG converter

## Tasks / Subtasks

- [x] Task 1: Implement Figma converter
  - [x] 1.1: Create `src/tokens/converters/figma.ts` with `convertFigmaVariables(raw, theme)`
  - [x] 1.2: `mapFigmaType()` — contextual type mapping (FLOAT → spacing/border-radius, STRING → typography)
  - [x] 1.3: `figmaColorToHex()` — convert Figma RGBA (0-1 range) to hex or rgba()
  - [x] 1.4: `selectMode()` — match mode by theme name (case-insensitive), fallback to first mode
  - [x] 1.5: `resolveAliasChain()` — follow Figma variable aliases by ID with cycle detection
  - [x] 1.6: Build lookupByValue and lookupByCssVar maps
  - [x] 1.7: Reuse `normalizeValue()` and `pathToCssVar()` from DTCG converter
- [x] Task 2: Write tests
  - [x] 2.1: Test `figmaColorToHex` conversions (RGB, white, black, alpha < 1)
  - [x] 2.2: Test color variable conversion with correct value
  - [x] 2.3: Test lookupByValue map building
  - [x] 2.4: Test lookupByCssVar map building
  - [x] 2.5: Test cssVar generation from token path
  - [x] 2.6: Test COLOR type mapping
  - [x] 2.7: Test FLOAT → spacing mapping
  - [x] 2.8: Test FLOAT with radius → border-radius mapping
  - [x] 2.9: Test light/dark/custom theme mode selection
  - [x] 2.10: Test alias chain resolution
  - [x] 2.11: Test aliasChain population
  - [x] 2.12: Test RGBA with alpha=1 normalization to hex
  - [x] 2.13: Test TokenMap metadata
  - [x] 2.14: Test STRING → typography mapping

## Dev Notes

### Files Created

```
pixelproof/
  src/tokens/converters/figma.ts  # Figma variable converter
  src/tokens/__tests__/figma-converter.test.ts
```

### Design Decisions

- Reuses `normalizeValue()` and `pathToCssVar()` from DTCG converter to ensure consistent output
- FLOAT type mapping is contextual: uses variable name to detect `radius` → `border-radius`, `shadow` → `shadow`, default → `spacing`
- STRING type mapping: detects `font`, `typography`, `text` in name → `typography`
- Alias resolution uses variable ID (not name) since Figma aliases reference by ID
- Cycle detection in alias resolution prevents infinite loops

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `convertFigmaVariables(raw, theme)` — full Figma → TokenMap conversion
- `figmaColorToHex()` — RGBA (0-1 range) to hex or rgba() notation
- Contextual type mapping: COLOR → color, FLOAT → spacing/border-radius, STRING → typography
- Multi-mode support with theme-based mode selection (case-insensitive match)
- Alias chain resolution by variable ID with cycle detection
- Reuses DTCG converter utilities for consistent output
- 14 new tests, zero regressions

### File List

- `pixelproof/src/tokens/converters/figma.ts` (new)
- `pixelproof/src/tokens/__tests__/figma-converter.test.ts` (new)

### Change Log

- 2026-03-22: Story 2.4 implemented — Figma variable converter with type mapping, alias resolution, multi-mode support
