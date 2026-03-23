# Story 3.2: JSX Style Prop Engine

Status: review

## Story

As a developer,
I want PixelProof to detect hardcoded CSS values in JSX inline `style` props,
so that violations like `<div style={{ color: '#6366f1' }} />` are caught and reported with the correct token suggestion.

## Acceptance Criteria

- [x] Detects violations in `style={{ color: '#6366f1' }}` JSX attributes
- [x] Returns violation with correct prop, found value, source ('jsx-style'), line, column
- [x] Skips whitelisted values (transparent, 0, etc.)
- [x] Skips dynamic expressions (ternaries, variable references, member expressions)
- [x] Detects multiple violations in one style object
- [x] Handles spread elements gracefully (ignores spread, checks remaining props)
- [x] Numeric values on spacing props auto-append 'px' for lookup (margin: 16 -> 16px)
- [x] Counts only token-eligible properties in `totalProperties` (ignores display, position, etc.)
- [x] Returns 0 violations in precision mode (value not in tokenMap)
- [x] Handles template literals with no interpolations
- [x] Populates nearestToken, figmaToken, resolvedValue from tokenMap

## Tasks / Subtasks

- [x] Task 1: Implement JSX style engine
  - [x] 1.1: Create `src/ast/engines/jsx-style.ts` with `scanJSXStyles()` function
  - [x] 1.2: Traverse AST for JSXAttribute nodes where name is 'style'
  - [x] 1.3: Process ObjectExpression properties — check key against CSS_STYLE_PROPS
  - [x] 1.4: Extract static values from StringLiteral, NumericLiteral, TemplateLiteral
  - [x] 1.5: Auto-append 'px' for numeric values on spacing/sizing properties
  - [x] 1.6: Call isViolation/findNearestToken from matchers for each value
  - [x] 1.7: Build Violation objects with violationId, source, confidence, token info
- [x] Task 2: Handle CJS/ESM interop for @babel/traverse
- [x] Task 3: Write tests
  - [x] 3.1: Test violation detection in simple style prop
  - [x] 3.2: Test whitelisted value skipping
  - [x] 3.3: Test dynamic reference skipping
  - [x] 3.4: Test multiple violations
  - [x] 3.5: Test conditional expression skipping
  - [x] 3.6: Test precision mode (no tokenMap match)
  - [x] 3.7: Test spread element handling
  - [x] 3.8: Test margin: 0 whitelisting
  - [x] 3.9: Test numeric value px append
  - [x] 3.10: Test totalProperties counting

### File List

- `pixelproof/src/ast/engines/jsx-style.ts` (new)
- `pixelproof/src/ast/__tests__/jsx-style.test.ts` (new)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `scanJSXStyles()` — Babel AST traversal for JSXAttribute `style` props with ObjectExpression values
- CJS/ESM interop for @babel/traverse handled via runtime type check
- `processObjectExpression()` — iterates ObjectProperty nodes, filters by CSS_STYLE_PROPS, extracts static values
- `extractStaticValue()` — handles StringLiteral, NumericLiteral (px append for spacing), TemplateLiteral (no interpolations)
- Returns EngineResult with violations array and totalProperties count
- 10 test cases covering violations, whitelisting, dynamic skipping, spreads, numeric values, and property counting

### File List

- `pixelproof/src/ast/engines/jsx-style.ts` (new)
- `pixelproof/src/ast/__tests__/jsx-style.test.ts` (new)

### Change Log

- 2026-03-22: Story 3.2 implemented — JSX inline style prop engine with Babel AST traversal, violation detection, and numeric-to-px conversion
