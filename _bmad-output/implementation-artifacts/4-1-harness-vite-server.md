# Story E4-S1: Harness Vite Dev Server

**Status:** review
**Epic:** Epic 4 — Iframe Harness + Component Isolation

## Tasks
- [x] Create `src/render/harness-server.ts` with Vite `createServer()` API
- [x] Configure `strictPort: true` in Vite server options
- [x] Build inline config merging user's vite config if present
- [x] Dynamically load `@vitejs/plugin-react`
- [x] Wrap EADDRINUSE as descriptive error
- [x] Add `vite` and `@vitejs/plugin-react` as dependencies
- [x] Write tests
- [x] All tests passing

## Implementation Notes
Uses Vite's `createServer()` API directly rather than spawning a subprocess, giving full programmatic control over the dev server lifecycle. The inline config is merged with any existing user vite config to avoid conflicts. `@vitejs/plugin-react` is loaded dynamically to keep it optional for non-React projects in the future. `strictPort: true` ensures the server fails fast with a clear EADDRINUSE error message rather than silently picking another port.

## Files Created/Modified
- `src/render/harness-server.ts` (created)
- `package.json` (modified — added `vite` and `@vitejs/plugin-react` dependencies)

## Test Coverage
- 10 tests in harness-server.test.ts

## Dev Agent
- Agent: Claude Opus 4.6
- Date: 2026-03-23
