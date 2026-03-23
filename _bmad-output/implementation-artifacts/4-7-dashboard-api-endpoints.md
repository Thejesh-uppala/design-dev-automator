# Story E4-S7: Dashboard API Endpoints

**Status:** review
**Epic:** Epic 4 — Iframe Harness + Component Isolation

## Tasks
- [x] Create `src/render/api-middleware.ts` as Connect-compatible middleware
- [x] Implement `/api/source` endpoint (text response, path traversal prevention)
- [x] Implement `/api/screenshot/:component` endpoint (PNG response)
- [x] Implement `/api/baseline/:component` endpoint (PNG response)
- [x] Implement `/api/diff/:component` endpoint (PNG response)
- [x] Implement `/api/tokens` endpoint (JSON cache response)
- [x] Add CORS headers on all responses
- [x] Add OPTIONS preflight support
- [x] Integrate middleware into harness-server.ts
- [x] Write tests
- [x] All tests passing

## Implementation Notes
The API middleware is implemented as a Connect-compatible middleware function so it plugs directly into Vite's dev server middleware stack. Path traversal prevention on `/api/source` normalizes and validates the requested path to block `../` attacks. Image endpoints (`screenshot`, `baseline`, `diff`) serve PNG files from the project's output directories. The `/api/tokens` endpoint returns the cached token JSON. CORS headers are applied to all responses and OPTIONS preflight requests are handled to support the dashboard running in a separate origin or iframe context.

## Files Created/Modified
- `src/render/api-middleware.ts` (created)
- `src/render/harness-server.ts` (modified — integrated API middleware)

## Test Coverage
- 17 tests in api-middleware.test.ts

## Dev Agent
- Agent: Claude Opus 4.6
- Date: 2026-03-23
