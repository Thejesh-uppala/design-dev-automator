# Story 3.7: AST Scanner Orchestrator

Status: review

## Story

As a developer,
I want PixelProof to automatically dispatch files to the correct AST engine(s) based on file extension and import detection,
so that a single `scanAll()` call processes the entire project and writes results to the Score Store.

## Acceptance Criteria

- [x] `scanFile()` dispatches .module.css/.module.scss to CSS Modules engine
- [x] `scanFile()` dispatches .css.ts to vanilla-extract engine
- [x] `scanFile()` dispatches .tsx/.jsx/.ts/.js to JSX style engine (always)
- [x] `scanFile()` additionally runs styled-components engine when `import ... from 'styled-components'` detected
- [x] `scanFile()` additionally runs Emotion engine when `@emotion/(react|styled|css)` import or `css={` pattern detected
- [x] `scanAll()` globs files using config.scan.include/exclude/fileTypes
- [x] `scanAll()` reads each file, calls `scanFile()`, writes results to ScoreStore via `setViolations()`
- [x] `scanAll()` returns total violation count
- [x] `scanAll()` logs scan summary (file count, violation count)
- [x] Files with no style patterns return 0 violations
- [x] Babel parser configured with jsx, typescript, decorators plugins and errorRecovery

## Tasks / Subtasks

- [x] Task 1: Implement scanner orchestrator
  - [x] 1.1: Create `src/ast/scanner.ts` with `scanFile()` and `scanAll()` functions
  - [x] 1.2: Implement `parseFile()` — Babel parser with jsx/typescript/decorators plugins, errorRecovery
  - [x] 1.3: Implement file routing logic — CSS Modules -> vanilla-extract -> JS/TS engines
  - [x] 1.4: Implement `hasStyledComponentsImport()` — regex detection of styled-components import
  - [x] 1.5: Implement `hasEmotionImport()` — regex detection of @emotion imports and css= prop pattern
  - [x] 1.6: Implement `scanAll()` — fast-glob, fileType filtering, ScoreStore integration
- [x] Task 2: Write tests
  - [x] 2.1: Test .tsx dispatch to JSX engine
  - [x] 2.2: Test .module.css dispatch to CSS Modules engine
  - [x] 2.3: Test .css.ts dispatch to vanilla-extract engine
  - [x] 2.4: Test styled-components import detection triggers engine
  - [x] 2.5: Test @emotion import detection triggers engine
  - [x] 2.6: Test utils.ts with no styles returns 0 violations

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `scanFile()` — single-file entry point with extension-based routing and import-based engine activation
- CSS Modules (.module.css/.module.scss) and vanilla-extract (.css.ts) are dispatched exclusively (early return)
- JS/TS/JSX/TSX files always run JSX style engine, plus conditionally run styled-components and Emotion engines
- `parseFile()` — Babel parser with jsx, typescript (for .ts/.tsx), decorators plugins, errorRecovery enabled
- `hasStyledComponentsImport()` / `hasEmotionImport()` — regex-based import detection
- `scanAll()` — fast-glob with config.scan.include/exclude, fileType filtering, ScoreStore.setViolations() for each file
- 6 test cases covering all dispatch paths and engine activation

### File List

- `pixelproof/src/ast/scanner.ts` (new)
- `pixelproof/src/ast/__tests__/scanner.test.ts` (new)

### Change Log

- 2026-03-22: Story 3.7 implemented — AST scanner orchestrator with file routing, import detection, fast-glob integration, ScoreStore output
