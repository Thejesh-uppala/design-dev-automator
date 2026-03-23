# Story 2.3: Fetch Layer Orchestrator

Status: review

## Story

As a developer,
I want PixelProof to automatically try multiple token sources in priority order,
so that I always get tokens regardless of whether MCP, REST API, or local files are available.

## Acceptance Criteria

1. **Tier 1 — MCP:** Calls `fetchViaFigmaMCP()`. If it returns data, use it. Log: `"Tokens fetched via Figma MCP"`
2. **Tier 2 — REST API:** If MCP returns `null` AND PAT is configured, calls `fetchViaFigmaREST()`. Log: `"Tokens fetched via Figma REST API"`
3. **Tier 3 — Local:** If both MCP and REST fail/unavailable, falls back to local `tokens/` directory. Log: `"Using local token files from tokens/"`
4. **All fail:** If no source returns data, throws: `"No token source available..."`
5. Returns `{ tokenMap: TokenMap, source: 'mcp' | 'rest-api' | 'local' | 'cache' }`
6. MCP failure does NOT log an error — only debug-level warning
7. REST API failure logs a warning with the specific reason
8. Cache integration: if cache is fresh, skips fetch entirely and returns cached TokenMap

## Tasks / Subtasks

- [x] Task 1: Implement fetch orchestrator
  - [x] 1.1: Create `src/tokens/fetcher.ts` with `fetchTokens(config, rootDir, options)`
  - [x] 1.2: Cache freshness check (skip fetch if fresh, unless `force: true`)
  - [x] 1.3: Tier 1 — MCP path with Figma converter integration
  - [x] 1.4: Tier 2 — REST API path with PAT resolution
  - [x] 1.5: Tier 3 — Local tokens fallback
  - [x] 1.6: Stale cache as last resort (preserved across loadLocalTokens overwrites)
  - [x] 1.7: Error throw when all sources exhausted
- [x] Task 2: Write tests
  - [x] 2.1: Test fresh cache returns cached tokens
  - [x] 2.2: Test force bypasses cache
  - [x] 2.3: Test MCP tier 1 path
  - [x] 2.4: Test REST API tier 2 fallback
  - [x] 2.5: Test local tokens tier 3 fallback
  - [x] 2.6: Test throws when all sources unavailable
  - [x] 2.7: Test stale cache used when REST fails
  - [x] 2.8: Test stale cache returned when expired and no fetch sources

## Dev Notes

### Files Created

```
pixelproof/
  src/tokens/fetcher.ts           # Fetch orchestrator
  src/tokens/__tests__/fetcher.test.ts
```

### Design Decisions

- Snapshots existing cache reference before tier 3 (loadLocalTokens may overwrite with empty cache)
- Empty caches (0 tokens) are not considered valid for fallback
- `FetchResult.source` includes `'cache'` as fourth option for cache hits

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- Three-tier fetch hierarchy: MCP → REST API → Local → stale cache last resort
- Cache freshness check with TTL (default 86400s)
- `force` option bypasses cache
- Stale cache preserved as reference to survive `loadLocalTokens` overwrites
- 8 new tests with mocked MCP/REST/converter modules
- Zero regressions

### File List

- `pixelproof/src/tokens/fetcher.ts` (new)
- `pixelproof/src/tokens/__tests__/fetcher.test.ts` (new)

### Change Log

- 2026-03-22: Story 2.3 implemented — three-tier fetch orchestrator with cache integration
