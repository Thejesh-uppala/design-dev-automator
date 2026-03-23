# Story E4-S3: Error Boundary + Render Failure Handling

**Status:** review
**Epic:** Epic 4 — Iframe Harness + Component Isolation

## Tasks
- [x] Embed ErrorBoundary as class component in the harness entry template
- [x] Implement `getDerivedStateFromError` for error state capture
- [x] Implement `componentDidCatch` for error logging
- [x] Implement `componentDidUpdate` for HMR reset via `resetKey`
- [x] Post `render-error` to parent via `postMessage`
- [x] Verify ScoreStore handles excluding error components from render fidelity aggregate
- [x] Write tests
- [x] All tests passing

## Implementation Notes
The ErrorBoundary is embedded directly as a class component in the harness entry template string rather than imported from a separate file, since virtual modules cannot easily import sibling modules. `componentDidUpdate` watches for `resetKey` changes to clear error state on HMR updates, allowing the developer to fix errors and see results immediately. The `postMessage` API communicates render failures to the parent dashboard frame. ScoreStore already handles excluding errored components from the render fidelity aggregate, so no changes were needed there.

## Files Created/Modified
- `src/render/vite-plugin.ts` (modified — ErrorBoundary added to harness entry template)

## Test Coverage
- 11 tests in error-boundary.test.ts

## Dev Agent
- Agent: Claude Opus 4.6
- Date: 2026-03-23
