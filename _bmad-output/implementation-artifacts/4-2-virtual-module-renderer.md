# Story E4-S2: Virtual Module + Component Renderer

**Status:** review
**Epic:** Epic 4 — Iframe Harness + Component Isolation

## Tasks
- [x] Create `src/render/vite-plugin.ts` as a Vite plugin
- [x] Implement virtual module `virtual:pixelproof-harness`
- [x] Implement `generateHarnessEntry()` to create React app from URL params
- [x] Read `component` and `export` URL params for dynamic import targeting
- [x] Render target component into `#pixelproof-root`
- [x] Show error messages for missing component/export params
- [x] Serve harness HTML at `/` and `/harness`
- [x] Write tests
- [x] All tests passing

## Implementation Notes
The virtual module approach avoids writing temporary files to disk. `generateHarnessEntry()` produces a self-contained React app that parses URL search params (`component` and `export`) to dynamically import the target module and render the specified export. This allows any component to be rendered in isolation by simply navigating to the correct URL. The harness HTML is served at both `/` and `/harness` for convenience.

## Files Created/Modified
- `src/render/vite-plugin.ts` (created)

## Test Coverage
- 22 tests in vite-plugin.test.ts

## Dev Agent
- Agent: Claude Opus 4.6
- Date: 2026-03-23
