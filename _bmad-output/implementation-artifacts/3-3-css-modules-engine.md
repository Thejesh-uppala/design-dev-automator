# Story 3.3: CSS Modules Engine

Status: review

## Story

As a developer,
I want PixelProof to detect hardcoded CSS values in `.module.css` and `.module.scss` files,
so that violations in CSS Module stylesheets are caught alongside JSX inline styles.

## Acceptance Criteria

- [x] Parses .module.css and .module.scss files using postcss with postcss-scss syntax
- [x] Detects violations in standard CSS declarations (color: #6366f1)
- [x] Skips CSS custom properties (--var-name) and SCSS variables ($var)
- [x] Skips var() references and SCSS variable references in values
- [x] Uses kebab-case property matching (CSS_STYLE_PROPS_KEBAB)
- [x] Handles multi-value declarations (border: 1px solid #6366f1) via extractValues
- [x] Returns violations with source 'css-module'
- [x] Skips whitelisted values (transparent, 0, etc.)
- [x] Returns 0 violations in precision mode (value not in tokenMap)
- [x] Counts totalProperties only for declarations containing matchable raw values
- [x] Skips non-token-eligible properties (display, position, etc.)
- [x] Gracefully handles postcss parse errors (returns empty result)

## Tasks / Subtasks

- [x] Task 1: Add postcss dependencies
  - [x] 1.1: Install postcss and postcss-scss as runtime dependencies
- [x] Task 2: Implement CSS Modules engine
  - [x] 2.1: Create `src/ast/engines/css-module.ts` with `scanCSSModule()` function
  - [x] 2.2: Parse CSS/SCSS content with postcss using postcss-scss syntax
  - [x] 2.3: Walk declarations with `root.walkDecls()`
  - [x] 2.4: Filter by CSS_STYLE_PROPS_KEBAB, skip $ and -- prefixed props
  - [x] 2.5: Skip values starting with $ or containing var()
  - [x] 2.6: Use extractValues for multi-value properties, check each segment
  - [x] 2.7: Build Violation objects with source 'css-module'
- [x] Task 3: Write tests
  - [x] 3.1: Test violation in basic color declaration
  - [x] 3.2: Test var(--color-primary) skipping
  - [x] 3.3: Test SCSS variable reference skipping
  - [x] 3.4: Test multi-value border declaration
  - [x] 3.5: Test whitelisted margin: 0
  - [x] 3.6: Test whitelisted background: transparent
  - [x] 3.7: Test font-size violation
  - [x] 3.8: Test precision mode
  - [x] 3.9: Test non-token-eligible property skipping

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `scanCSSModule()` — postcss-based parsing of .module.css/.module.scss with postcss-scss syntax
- Walks all declarations, filters by CSS_STYLE_PROPS_KEBAB, skips SCSS vars and CSS custom properties
- Multi-value support via extractValues — each segment checked independently
- totalProperties only incremented for declarations containing raw matchable values (hex, px, em, rem, rgb, hsl)
- New dependencies: postcss, postcss-scss
- 9 test cases covering violations, variable skipping, multi-value, whitelisting, precision mode

### File List

- `pixelproof/src/ast/engines/css-module.ts` (new)
- `pixelproof/src/ast/__tests__/css-module.test.ts` (new)

### Change Log

- 2026-03-22: Story 3.3 implemented — CSS Modules engine with postcss/postcss-scss parsing, multi-value support, SCSS variable awareness
