# Story E4-S5: Provider Wrapping in Harness

**Status:** review
**Epic:** Epic 4 — Iframe Harness + Component Isolation

## Tasks
- [x] Implement `generateProviderImports` in vite-plugin.ts
- [x] Implement `generateProviderWrapOpen` in vite-plugin.ts
- [x] Implement `generateProviderWrapClose` in vite-plugin.ts
- [x] Skip providers with `hasDynamicProps`
- [x] Pass static props via `React.createElement`
- [x] Add `providers?: string[]` to `RenderConfig` schema for config-based override
- [x] Write tests
- [x] All tests passing

## Implementation Notes
Provider wrapping is implemented as three code-generation functions that produce import statements, opening wrapper elements, and closing elements respectively. Providers with dynamic props are automatically skipped since their runtime values cannot be statically reproduced in the harness. Static props are passed using `React.createElement` to avoid JSX parsing complexity in the generated code. A `providers` array in `RenderConfig` allows users to explicitly specify which providers to include, overriding auto-detection when needed.

## Files Created/Modified
- `src/render/vite-plugin.ts` (modified — added provider wrapping code generation)
- `src/schemas/` (modified — added `providers?: string[]` to `RenderConfig`)

## Test Coverage
- 7 tests in provider-wrapping.test.ts

## Dev Agent
- Agent: Claude Opus 4.6
- Date: 2026-03-23
