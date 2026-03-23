# Story E4-S6: mockProps Support

**Status:** review
**Epic:** Epic 4 — Iframe Harness + Component Isolation

## Tasks
- [x] Implement `generateMockPropsCode` in vite-plugin.ts
- [x] Generate `MOCK_PROPS` lookup table in harness entry
- [x] Generate `getMockProps()` function for runtime prop resolution
- [x] Change `ComponentRenderConfig.mockProps` type from `string` to `Record<string, unknown>` per ADR
- [x] Support nested objects, arrays, and string children
- [x] Write tests
- [x] All tests passing

## Implementation Notes
The mockProps implementation generates a static lookup table (`MOCK_PROPS`) and a `getMockProps()` resolver function in the harness entry code. The `ComponentRenderConfig.mockProps` type was changed from `string` to `Record<string, unknown>` per ADR decision to support inline objects only in v1.0, avoiding the complexity of external mock files. The code generator handles nested objects, arrays, and string children by serializing them into valid JavaScript literals in the generated harness entry.

## Files Created/Modified
- `src/render/vite-plugin.ts` (modified — added mock props code generation)
- `src/schemas/` (modified — changed `mockProps` type to `Record<string, unknown>`)

## Test Coverage
- 7 tests in mock-props.test.ts

## Dev Agent
- Agent: Claude Opus 4.6
- Date: 2026-03-23
