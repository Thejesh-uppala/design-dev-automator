# Story 3.5: Emotion Engine

Status: review

## Story

As a developer,
I want PixelProof to detect hardcoded CSS values in Emotion's css prop and styled API,
so that violations in `<div css={{ color: '#6366f1' }} />`, `css({ ... })`, and `css\`...\`` are caught and reported.

## Acceptance Criteria

- [x] Detects violations in `css={{ color: '#6366f1' }}` JSX prop (object syntax)
- [x] Detects violations in `css={css\`color: #6366f1;\`}` JSX prop (template literal syntax)
- [x] Detects violations in `css({ fontSize: '16px' })` function call with object argument
- [x] Skips dynamic references in css prop (theme.primary, etc.)
- [x] Does NOT process `style` props (JSX engine handles those separately)
- [x] Returns violations with source 'emotion'
- [x] Reuses `parseCSSAndCheck()` from styled-components engine for template literal parsing
- [x] Uses camelCase property matching (CSS_STYLE_PROPS) for object syntax
- [x] Handles StringLiteral, NumericLiteral, TemplateLiteral static values

## Tasks / Subtasks

- [x] Task 1: Implement Emotion engine
  - [x] 1.1: Create `src/ast/engines/emotion.ts` with `scanEmotion()` function
  - [x] 1.2: Handle JSXAttribute `css` prop — ObjectExpression (object syntax)
  - [x] 1.3: Handle JSXAttribute `css` prop — TaggedTemplateExpression (css\`...\` syntax)
  - [x] 1.4: Handle CallExpression `css({...})` — object argument
  - [x] 1.5: Implement `processObjectExpression()` — iterate object props, check CSS_STYLE_PROPS, extract values
  - [x] 1.6: Implement `extractStaticValue()` — StringLiteral, NumericLiteral, TemplateLiteral
  - [x] 1.7: Reuse `parseCSSAndCheck()` from styled-components engine for template parsing
  - [x] 1.8: Handle CJS/ESM interop for @babel/traverse
- [x] Task 2: Write tests
  - [x] 2.1: Test violation in css={{ }} object prop
  - [x] 2.2: Test violation in css() call with object
  - [x] 2.3: Test dynamic reference skipping
  - [x] 2.4: Test style prop is NOT processed (defers to JSX engine)
  - [x] 2.5: Test violation in css prop template literal

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `scanEmotion()` — Babel AST traversal for JSXAttribute `css` props and `css()` CallExpressions
- Handles three Emotion patterns: css={{ obj }}, css={css\`...\`}, css({ obj })
- Object syntax uses CSS_STYLE_PROPS (camelCase), template syntax delegates to `parseCSSAndCheck()` from styled-components engine
- Explicitly does NOT touch `style` props — clean separation from JSX engine
- 5 test cases covering object props, function calls, dynamic skipping, style prop isolation, template literals

### File List

- `pixelproof/src/ast/engines/emotion.ts` (new)
- `pixelproof/src/ast/__tests__/emotion.test.ts` (new)

### Change Log

- 2026-03-22: Story 3.5 implemented — Emotion engine with css prop (object + template), css() call, and parseCSSAndCheck reuse
