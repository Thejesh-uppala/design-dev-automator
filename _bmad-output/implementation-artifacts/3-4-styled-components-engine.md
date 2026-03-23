# Story 3.4: styled-components Engine

Status: review

## Story

As a developer,
I want PixelProof to detect hardcoded CSS values in styled-components template literals,
so that violations in `styled.button\`color: #6366f1;\`` and `css\`...\`` are caught and reported.

## Acceptance Criteria

- [x] Detects violations in `styled.button\`...\`` tagged template expressions
- [x] Detects violations in `styled(Component)\`...\`` HOC pattern
- [x] Detects violations in `css\`...\`` tagged template literals
- [x] Skips dynamic interpolations (${props => ...}, ${theme.color}) by replacing with placeholder comments
- [x] Handles mixed static and dynamic content — only flags static segments
- [x] Parses extracted CSS with postcss for accurate declaration walking
- [x] Uses kebab-case property matching (CSS_STYLE_PROPS_KEBAB)
- [x] Returns violations with source 'styled-components'
- [x] Skips whitelisted values (transparent, etc.)
- [x] Line numbers offset correctly from template literal start position
- [x] Exports `parseCSSAndCheck()` for reuse by Emotion engine

## Tasks / Subtasks

- [x] Task 1: Implement styled-components engine
  - [x] 1.1: Create `src/ast/engines/styled-components.ts` with `scanStyledComponents()` function
  - [x] 1.2: Traverse AST for TaggedTemplateExpression nodes
  - [x] 1.3: Implement `isStyledTag()` — matches styled.x, styled(Component), css tagged templates
  - [x] 1.4: Implement `extractCSS()` — builds CSS string from TemplateLiteral quasis, replaces interpolations with `/* __INTERPOLATION__ */`
  - [x] 1.5: Implement `parseCSSAndCheck()` — shared postcss parsing and violation checking with line offset
  - [x] 1.6: Skip declarations containing `__INTERPOLATION__` placeholder
  - [x] 1.7: Handle CJS/ESM interop for @babel/traverse
- [x] Task 2: Write tests
  - [x] 2.1: Test violation in styled.button template
  - [x] 2.2: Test dynamic interpolation skipping
  - [x] 2.3: Test whitelisted transparent
  - [x] 2.4: Test multiple violations
  - [x] 2.5: Test css tagged template
  - [x] 2.6: Test styled(Component) HOC pattern
  - [x] 2.7: Test mixed static and dynamic content

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `scanStyledComponents()` — Babel AST traversal for TaggedTemplateExpression nodes
- `isStyledTag()` — recognizes styled.x, styled(Component), and css tagged templates
- `extractCSS()` — concatenates template literal quasis with `/* __INTERPOLATION__ */` placeholders for dynamic parts
- `parseCSSAndCheck()` — shared utility (exported for Emotion reuse): postcss parsing, declaration walking, violation checking with line offset calculation
- Skips declarations with __INTERPOLATION__ in value, CSS custom properties, SCSS variables
- 7 test cases covering all styled-components patterns, interpolation handling, and multi-violation detection

### File List

- `pixelproof/src/ast/engines/styled-components.ts` (new)
- `pixelproof/src/ast/__tests__/styled-components.test.ts` (new)

### Change Log

- 2026-03-22: Story 3.4 implemented — styled-components engine with template literal parsing, interpolation placeholder handling, shared parseCSSAndCheck utility
