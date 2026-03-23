# Story 2.5: Cache TTL + Invalidation

Status: review

## Story

As a developer,
I want `npx pixelproof sync` to respect cache TTL and support force refresh,
so that I can control when tokens are re-fetched from Figma.

## Acceptance Criteria

1. `isCacheFresh(syncTTL)` reads `syncedAt` from cache, compares against current time + configured TTL (default 86400s = 24h)
2. `npx pixelproof sync` fetches tokens only if cache is stale or missing
3. `npx pixelproof sync --force` always fetches regardless of cache freshness
4. `npx pixelproof start` checks cache freshness at startup — syncs if stale, uses cache if fresh
5. After successful fetch: writes new cache with updated `syncedAt`
6. Prints sync result: `"Token sync complete: {N} tokens from {source} (cached at {timestamp})"`
7. Failed sync with existing cache: warns but continues with stale cache
8. Failed sync with NO existing cache: falls through to local tokens (tier 3)

## Tasks / Subtasks

- [x] Task 1: Wire CLI commands
  - [x] 1.1: Update `src/cli/index.ts` — add `--force` option to `sync` command
  - [x] 1.2: Wire `sync` action to `fetchTokens(config, rootDir, { force })`
  - [x] 1.3: Wire `start` action to `fetchTokens(config, rootDir)` (respects cache)
  - [x] 1.4: Print token sync result with count, source, and timestamp
  - [x] 1.5: Error handling with user-friendly messages
- [x] Task 2: Verify cache TTL (covered by E1-S5 tests)
  - [x] 2.1: `isCacheFresh()` already implemented and tested in E1-S5
  - [x] 2.2: Fresh cache (within TTL) → skip fetch (tested in fetcher.test.ts)
  - [x] 2.3: Stale cache (expired TTL) → trigger fetch (tested in fetcher.test.ts)
  - [x] 2.4: Force flag bypasses cache (tested in fetcher.test.ts)

## Dev Notes

### Files Modified

```
pixelproof/
  src/cli/index.ts                # Added --force flag, wired fetcher
```

### Design Decisions

- `isCacheFresh()` was already implemented and tested in E1-S5 (cache.ts) — no changes needed
- Cache TTL integration is fully handled by the fetcher (E2-S3) — CLI just passes options through
- `start` command uses default `fetchTokens()` (respects cache), `sync --force` passes `{ force: true }`
- CLI actions are async to support the fetcher's async operations

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- CLI `sync` command wired with `--force` flag
- CLI `start` command syncs tokens at startup (cache-aware)
- Token sync result printed: count + source + timestamp
- Error handling with `process.exitCode = 1` (no hard exit)
- `isCacheFresh()` and cache TTL logic reused from E1-S5
- 0 additional tests (cache TTL covered by E1-S5, force/freshness covered by fetcher tests)

### File List

- `pixelproof/src/cli/index.ts` (modified)

### Change Log

- 2026-03-22: Story 2.5 implemented — CLI sync --force wired, start command syncs at startup
