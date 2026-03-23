# Story 3.6: vanilla-extract Engine

Status: review

## Story

As a developer,
I want PixelProof to detect hardcoded CSS values in vanilla-extract .css.ts files,
so that violations in `style()`, `globalStyle()`, `recipe()`, and `styleVariants()` calls are caught and reported.

## Acceptance Criteria

- [x] Only processes files ending in `.css.ts` — returns empty for other extensions
- [x] Detects violations in `style({ color: '#6366f1' })` calls
- [x] Detects violations in `globalStyle('.root', { ... })` — style object is the 2nd argument
- [x] Detects violations in `recipe({ base: {...}, variants: { variant: { value: {...} } } })`
- [x] Detects violations in `styleVariants({ primary: {...}, secondary: {...} })`
- [x] Handles nested selector objects (selectors: { '&:hover': { color: '#6366f1' } })
- [x] Skips dynamic variable references (vars.primary, etc.)
- [x] Returns violations with source 'vanilla-extract'
- [x] Uses camelCase property matching (CSS_STYLE_PROPS)
- [x] Recognizes VE_FUNCTIONS set: style, globalStyle, recipe, styleVariants, fontFace, keyframes

## Tasks / Subtasks

- [x] Task 1: Implement vanilla-extract engine
  - [x] 1.1: Create `src/ast/engines/vanilla-extract.ts` with `scanVanillaExtract()` function
  - [x] 1.2: File extension gate — skip non-.css.ts files
  - [x] 1.3: Traverse AST for CallExpression nodes matching VE_FUNCTIONS
  - [x] 1.4: Implement `processStyleObject()` — recurse into nested objects (selectors, @media)
  - [x] 1.5: Implement `processRecipe()` — handle base and variants properties
  - [x] 1.6: Implement `processStyleVariants()` — iterate variant entries, process each style object
  - [x] 1.7: Implement `getCalleeName()` — handle Identifier and MemberExpression callees
  - [x] 1.8: Handle CJS/ESM interop for @babel/traverse
- [x] Task 2: Write tests
  - [x] 2.1: Test violation in style()
  - [x] 2.2: Test violation in globalStyle()
  - [x] 2.3: Test violations in recipe() base + variants
  - [x] 2.4: Test violation in styleVariants()
  - [x] 2.5: Test variable reference skipping
  - [x] 2.6: Test nested selector object
  - [x] 2.7: Test non-.css.ts file returns empty

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `scanVanillaExtract()` — Babel AST traversal for CallExpression nodes matching VE_FUNCTIONS set
- File extension gate: only processes .css.ts files, returns empty result for all others
- `processStyleObject()` — recursive: iterates ObjectProperty nodes, recurses into nested ObjectExpressions (selectors, @media), checks CSS_STYLE_PROPS for leaf properties
- `processRecipe()` — handles `base` property (direct style object) and `variants` (three-level nesting: variant group > variant value > style object)
- `processStyleVariants()` — iterates top-level entries, processes each as a style object
- `getCalleeName()` — handles both Identifier (style) and MemberExpression (ve.style) callees
- 7 test cases covering all VE function patterns, nesting, variable skipping, and file extension gating

### File List

- `pixelproof/src/ast/engines/vanilla-extract.ts` (new)
- `pixelproof/src/ast/__tests__/vanilla-extract.test.ts` (new)

### Change Log

- 2026-03-22: Story 3.6 implemented — vanilla-extract engine with style/globalStyle/recipe/styleVariants support, recursive selector handling, .css.ts file gating
