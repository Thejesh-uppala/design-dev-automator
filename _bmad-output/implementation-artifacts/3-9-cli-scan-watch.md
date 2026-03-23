# Story 3.9: CLI Integration — Scan + Watch Loop

Status: review

## Story

As a developer,
I want the `pixelproof start` command to perform a full AST scan, print token compliance results, and then watch for file changes to rescan incrementally,
so that I get live feedback on token violations as I edit components.

## Acceptance Criteria

- [x] `pixelproof start` loads config, syncs tokens, runs full `scanAll()`, prints compliance summary
- [x] After initial scan, starts FileWatcher for incremental rescanning on file changes
- [x] On file change: reads file, calls `scanFile()`, updates ScoreStore, prints per-file compliance delta
- [x] Prints individual violations with file:line, property, found value, and expected token
- [x] Gracefully handles missing token data — warns and uses empty tokenMap
- [x] Prints aggregate Token Compliance percentage after scan
- [x] Clean exit on SIGINT (Ctrl+C) — stops watcher, exits 0
- [x] Error handling: catches and logs errors, sets exit code 1
- [x] Watch loop prints compliance change (+/-) relative to previous score for the changed file
- [x] `pixelproof sync` supports --force flag to bypass cache

## Tasks / Subtasks

- [x] Task 1: Integrate scan + watch into CLI start command
  - [x] 1.1: Modify `src/cli/index.ts` start command — load config, sync tokens, run scanAll
  - [x] 1.2: Print token sync summary (count, source, timestamp)
  - [x] 1.3: Print aggregate Token Compliance percentage and violation count
  - [x] 1.4: Print individual violations with [VIOLATION] prefix, file:line, prop, found, expected token
  - [x] 1.5: Start FileWatcher with config.scan settings
  - [x] 1.6: On file change: read, scanFile, update ScoreStore, print compliance delta
  - [x] 1.7: Handle token fetch failure — warn and use empty tokenMap fallback
  - [x] 1.8: Handle SIGINT for clean exit
- [x] Task 2: Enhance sync command
  - [x] 2.1: Add --force option to sync command
  - [x] 2.2: Pass force flag to fetchTokens

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `start` command now performs end-to-end flow: config load -> token sync -> full scan -> violation reporting -> watch loop
- Token sync failure handled gracefully with warning and empty tokenMap fallback
- `scanAll()` writes results to ScoreStore, prints aggregate compliance percentage
- Individual violations printed with [VIOLATION] prefix showing file:line, prop="value", expected token var()
- FileWatcher integration: on change, rescans single file, updates ScoreStore, prints compliance delta (+/- change)
- SIGINT handler stops watcher and exits cleanly
- `sync` command enhanced with --force option passed through to fetchTokens
- 296 total tests, zero regressions

### File List

- `pixelproof/src/cli/index.ts` (modified)

### Change Log

- 2026-03-22: Story 3.9 implemented — CLI start command with full scan, violation reporting, watch loop with incremental rescan, sync --force flag
