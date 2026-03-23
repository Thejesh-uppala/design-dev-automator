# Story E4-S4: Provider Detection

**Status:** review
**Epic:** Epic 4 — Iframe Harness + Component Isolation

## Tasks
- [x] Create `src/render/provider-detector.ts`
- [x] AST scan entry files (main.tsx, index.tsx, App.tsx) for known provider patterns
- [x] Detect ThemeProvider, Provider, QueryClientProvider, BrowserRouter, and other common providers
- [x] Extract component name and import path for each detected provider
- [x] Classify props as static vs dynamic
- [x] Order detected providers by nesting depth (outermost first)
- [x] Write tests
- [x] All tests passing

## Implementation Notes
The provider detector performs AST analysis on common entry files to identify wrapper providers that components may depend on at runtime. Known provider patterns are matched by component name. Props are classified as static (literal values) or dynamic (expressions, variables) to determine whether they can be safely replicated in the harness. Providers are ordered outermost-first to preserve the correct nesting hierarchy when wrapping isolated components.

## Files Created/Modified
- `src/render/provider-detector.ts` (created)

## Test Coverage
- 13 tests in provider-detector.test.ts

## Dev Agent
- Agent: Claude Opus 4.6
- Date: 2026-03-23
