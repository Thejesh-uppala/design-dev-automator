# Story 2.2: Figma REST API Client (PAT Fallback)

Status: review

## Story

As a developer,
I want PixelProof to fetch design tokens via the Figma REST API using my Personal Access Token,
so that token syncing works when MCP is unavailable.

## Acceptance Criteria

1. Authenticates with Figma REST API using `X-FIGMA-TOKEN` header
2. Fetches variables via `GET /v1/files/:file_key/variables/local`
3. Also fetches published variables via `GET /v1/files/:file_key/variables/published` and merges (local takes precedence on conflict)
4. On HTTP 429 (rate limited): retries with exponential backoff (1s, 2s, 4s) — max 3 retries
5. On HTTP 403: throws "Figma PAT is invalid or expired. Generate a new token at figma.com/settings"
6. On HTTP 404: throws "Figma file not found: {fileId}"
7. PAT is NEVER logged, NEVER included in error messages, NEVER echoed to stdout
8. Returns the same `RawFigmaVariables` shape as the MCP client
9. Timeout: 30 seconds per request

## Tasks / Subtasks

- [x] Task 1: Implement REST client
  - [x] 1.1: Create `src/tokens/figma-rest.ts` with `fetchViaFigmaREST(fileId, pat)`
  - [x] 1.2: `figmaFetch()` — authenticated request with 30s timeout via AbortController
  - [x] 1.3: HTTP 403/404/429 error handling with descriptive messages
  - [x] 1.4: `figmaFetchWithRetry()` — exponential backoff on 429 (1s, 2s, 4s, max 3 retries)
  - [x] 1.5: `normalizeResponse()` — normalize REST API response to `RawFigmaVariables`
  - [x] 1.6: `mergeRawVariables()` — merge local + published (local wins on conflict)
  - [x] 1.7: `resolvePAT()` — FIGMA_PAT env var → config PAT → null
- [x] Task 2: Write tests
  - [x] 2.1: Test `resolvePAT` env var priority
  - [x] 2.2: Test valid PAT + fileId returns `RawFigmaVariables`
  - [x] 2.3: Test X-FIGMA-TOKEN header is sent
  - [x] 2.4: Test 403 throws PAT-specific error (without PAT value)
  - [x] 2.5: Test error messages never contain PAT
  - [x] 2.6: Test 404 throws file-not-found error
  - [x] 2.7: Test 429 retries with backoff then succeeds
  - [x] 2.8: Test persistent 429 throws after max retries
  - [x] 2.9: Test published endpoint failure falls back to local-only
  - [x] 2.10: Test local takes precedence over published on conflict

## Dev Notes

### Files Created

```
pixelproof/
  src/tokens/figma-rest.ts        # REST API client
  src/tokens/__tests__/figma-rest.test.ts
```

### Design Decisions

- Uses Node 18+ global `fetch` — no external HTTP library
- Published endpoint failure is non-fatal (local vars are sufficient)
- PAT security: never included in any error message or log output
- Tests use `vi.stubGlobal('fetch', mockFetch)` for clean fetch mocking

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `fetchViaFigmaREST()` — fetches local + published variables, merges with local precedence
- Exponential backoff on 429: 1s → 2s → 4s, max 3 retries
- Descriptive errors for 403 (PAT invalid) and 404 (file not found)
- PAT never exposed in errors or logs
- `resolvePAT()` — env var → config → null priority
- 10 new tests, zero regressions

### File List

- `pixelproof/src/tokens/figma-rest.ts` (new)
- `pixelproof/src/tokens/__tests__/figma-rest.test.ts` (new)

### Change Log

- 2026-03-22: Story 2.2 implemented — Figma REST API client with rate limiting, PAT security, merge logic
