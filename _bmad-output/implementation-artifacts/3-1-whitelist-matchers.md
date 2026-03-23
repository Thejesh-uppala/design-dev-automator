# Story 3.1: Whitelist + Value Pattern Matching

Status: review

## Story

As a developer,
I want PixelProof to have a whitelist of safe CSS values and pattern-matching utilities for detecting hardcoded values,
so that the AST engines can accurately identify token violations while ignoring CSS keywords, zero values, and dynamic expressions.

## Acceptance Criteria

- [x] Static whitelist of CSS values that should never be flagged (transparent, inherit, currentColor, none, initial, unset, revert, auto, 0, 100%, 50%, white, black, 0px)
- [x] `isWhitelisted()` is case-insensitive
- [x] `VALUE_PATTERN` regex matches hex colors, rgb/rgba, hsl/hsla, px, em, rem values
- [x] `VALUE_PATTERN` does not match var(), transparent, inherit, theme references
- [x] `normalizeForLookup()` converts short hex to 6-digit (#fff -> #ffffff), lowercases hex, converts rgb() to hex
- [x] `normalizeForLookup()` preserves rgba with alpha < 1
- [x] `isViolation()` returns false for whitelisted values, non-matching patterns, and values not in tokenMap (precision mode)
- [x] `isViolation()` returns true when normalized value exists in tokenMap.lookupByValue
- [x] `findNearestToken()` returns matching token paths from lookupByValue
- [x] `isTokenEligibleProp()` recognizes both camelCase (JSX) and kebab-case (CSS) property names
- [x] `violationTypeFromProp()` maps properties to color, typography, spacing, border-radius, shadow categories
- [x] `extractValues()` splits multi-value declarations while keeping rgb()/rgba()/hsl() function calls intact

## Tasks / Subtasks

- [x] Task 1: Create whitelist module
  - [x] 1.1: Create `src/ast/whitelist.ts` with `WHITELIST_VALUES` set and `isWhitelisted()` function
- [x] Task 2: Create matchers module
  - [x] 2.1: Create `src/ast/matchers.ts` with `CSS_STYLE_PROPS` (camelCase) and `CSS_STYLE_PROPS_KEBAB` (kebab-case) sets
  - [x] 2.2: Implement `VALUE_PATTERN` regex for hex, rgb, hsl, px, em, rem
  - [x] 2.3: Implement `normalizeForLookup()` — short hex expansion, lowercase, rgb-to-hex conversion
  - [x] 2.4: Implement `isViolation()` — whitelist check, pattern match, normalize, tokenMap lookup
  - [x] 2.5: Implement `findNearestToken()` — lookupByValue query
  - [x] 2.6: Implement `violationTypeFromProp()` — category mapping by property name
  - [x] 2.7: Implement `isTokenEligibleProp()` — camelCase and kebab-case check
  - [x] 2.8: Implement `extractValues()` — space-split with parenthesis-aware grouping
- [x] Task 3: Write tests
  - [x] 3.1: Test whitelist with all whitelisted values, case-insensitivity, and non-whitelisted values
  - [x] 3.2: Test VALUE_PATTERN matches and non-matches
  - [x] 3.3: Test normalizeForLookup short hex, 6-digit hex, rgb, rgba
  - [x] 3.4: Test isViolation for violations, whitelisted, precision mode, var(), calc()
  - [x] 3.5: Test findNearestToken match and no-match cases
  - [x] 3.6: Test isTokenEligibleProp camelCase and kebab-case
  - [x] 3.7: Test violationTypeFromProp category mappings
  - [x] 3.8: Test extractValues space-split and rgb() grouping

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `isWhitelisted()` — case-insensitive check against static Set of 14 safe CSS values
- `VALUE_PATTERN` — regex matching hex (#fff, #6366f1), rgb/rgba, hsl/hsla, px/em/rem numeric values
- `normalizeForLookup()` — #abc to #aabbcc, lowercase, rgb(r,g,b) to hex, preserves rgba with alpha < 1
- `isViolation()` — precision-mode: only flags values that exist in tokenMap.lookupByValue after normalization
- `findNearestToken()` — returns token path(s) for a given value
- `violationTypeFromProp()` — maps CSS props to color/typography/spacing/border-radius/shadow categories
- `isTokenEligibleProp()` — recognizes 33 camelCase + 33 kebab-case CSS properties
- `extractValues()` — parenthesis-aware space splitting for multi-value declarations (e.g., border shorthand)
- 30+ test cases covering all exported functions

### File List

- `pixelproof/src/ast/whitelist.ts` (new)
- `pixelproof/src/ast/matchers.ts` (new)
- `pixelproof/src/ast/__tests__/matchers.test.ts` (new)

### Change Log

- 2026-03-22: Story 3.1 implemented — whitelist, value pattern matching, normalization, violation detection, property eligibility, and value extraction utilities
