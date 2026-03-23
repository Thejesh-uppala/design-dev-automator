# Story 1.8: File Watcher

Status: review

## Story

As a developer,
I want PixelProof to watch my project files for changes and emit debounced events,
so that the scanner can re-analyze individual files on save without manual re-runs.

## Acceptance Criteria

1. Watches all paths matching `scan.include` globs from config
2. Ignores paths matching `scan.exclude` globs
3. Only watches files matching `scan.fileTypes` extensions
4. Debounces: multiple saves within 300ms produce a single change event
5. `onChange(callback)` registers a handler — receives `{ file: string, event: 'change' | 'add' | 'unlink' }`
6. `start()` begins watching, returns a promise that resolves when watcher is ready
7. `stop()` tears down the watcher cleanly (no lingering file handles)
8. On `unlink` (file deleted): emits unlink event (Score Store removal wired later in E3)

## Tasks / Subtasks

- [x] Task 1: Install chokidar dependency
  - [x] 1.1: Add `chokidar` as a dependency
- [x] Task 2: Implement FileWatcher class (AC: #1–#8)
  - [x] 2.1: Create `src/watcher/index.ts` with `FileWatcher` class
  - [x] 2.2: Constructor accepts `rootDir` and `ScanConfig`
  - [x] 2.3: `start()` initializes chokidar watcher with include/exclude/fileTypes, returns Promise resolving on 'ready'
  - [x] 2.4: `onChange(callback)` registers event handler
  - [x] 2.5: Debounce: buffer events per file for 300ms before emitting
  - [x] 2.6: `stop()` closes chokidar watcher, clears debounce timers
  - [x] 2.7: Use `awaitWriteFinish` for Windows compatibility
- [x] Task 3: Write tests (AC: #1–#7)
  - [x] 3.1: Test start() resolves when watcher is ready
  - [x] 3.2: Test onChange fires on file change
  - [x] 3.3: Test onChange fires on file add
  - [x] 3.4: Test onChange fires on file unlink
  - [x] 3.5: Test debounce — rapid saves produce single event
  - [x] 3.6: Test stop() prevents further events
  - [x] 3.7: Test excluded files do not trigger events

## Dev Notes

### Existing Project State — DO NOT MODIFY these files

```
pixelproof/
  src/cli/index.ts              # E1-S1
  src/config/schema.ts          # E1-S2
  src/config/defaults.ts        # E1-S2
  src/config/loader.ts          # E1-S2
  src/tokens/                   # E1-S3, S4, S5
  src/scoring/                  # E1-S6
  src/discovery/                # E1-S7
```

### Files to Create

```
pixelproof/
  src/watcher/
    index.ts                    # FileWatcher class
  src/watcher/__tests__/
    watcher.test.ts             # File watcher tests
```

### New Dependency

```
dependencies:
  chokidar                      # File system watcher
```

Part of the architecture's recommended stack. Use `awaitWriteFinish` option for Windows compatibility.

### ScanConfig Interface (from `src/config/schema.ts`)

```typescript
export interface ScanConfig {
  include: string[];   // e.g., ['src/**']
  exclude: string[];   // e.g., ['**/*.test.tsx', '**/*.stories.tsx', '**/node_modules/**']
  fileTypes: string[]; // e.g., ['tsx', 'ts', 'jsx', 'js', 'css', 'scss']
}
```

### FileWatcher API

```typescript
export interface WatchEvent {
  file: string;            // relative path from rootDir
  event: 'change' | 'add' | 'unlink';
}

export class FileWatcher {
  constructor(rootDir: string, scanConfig: ScanConfig);

  // Begin watching. Resolves when chokidar reports 'ready'.
  start(): Promise<void>;

  // Register a change handler. Multiple handlers supported.
  onChange(callback: (event: WatchEvent) => void): void;

  // Stop watching. Clears all timers and closes chokidar.
  stop(): Promise<void>;
}
```

### Chokidar Configuration

```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch(scanConfig.include, {
  cwd: rootDir,
  ignored: scanConfig.exclude,
  ignoreInitial: true,        // Don't emit events for existing files
  awaitWriteFinish: {         // Windows: wait for write to complete
    stabilityThreshold: 100,
    pollInterval: 50,
  },
});
```

### File Type Filtering

Chokidar doesn't natively filter by extension. Filter in the event handler:

```typescript
const allowedExtensions = new Set(scanConfig.fileTypes.map(t => `.${t}`));

function isAllowedFile(filePath: string): boolean {
  return allowedExtensions.has(path.extname(filePath).toLowerCase());
}
```

### Debounce Strategy

Per-file debounce using `setTimeout`:

```typescript
const debounceTimers = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 300;

function debouncedEmit(file: string, event: WatchEvent['event']): void {
  const existing = debounceTimers.get(file);
  if (existing) clearTimeout(existing);

  debounceTimers.set(file, setTimeout(() => {
    debounceTimers.delete(file);
    for (const cb of listeners) {
      cb({ file, event });
    }
  }, DEBOUNCE_MS));
}
```

### Testing Pattern — Real File Watching

File watcher tests need real filesystem events. Use temp directories and actual file writes:

```typescript
import { mkdtempSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rootDir = mkdtempSync(join(tmpdir(), 'pixelproof-watcher-test-'));
```

**Important:** File watcher tests are inherently async and timing-sensitive. Use:
- `await new Promise(resolve => setTimeout(resolve, ms))` for waiting
- Reasonable timeouts (500-1000ms) to account for debounce + OS file event propagation
- `afterEach` to call `watcher.stop()` to prevent handle leaks

### ES Modules

Project uses `"type": "module"`. All imports must use `.js` extension for local modules.

### Testing Framework

Vitest. Run with `npx vitest run` from `pixelproof/` directory.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Chokidar v5 on Windows requires absolute directory paths, not cwd-relative glob patterns — `src/**` resolved to `resolve(rootDir, 'src')`
- Chokidar v5 `ignored` option needs regex patterns (not glob strings) when working with absolute paths — converted glob excludes to RegExp
- `awaitWriteFinish` + debounce requires ~1500ms total wait in tests for Windows FS event propagation

### Completion Notes List

- `FileWatcher` class with `start()`, `stop()`, `onChange()` API
- `WatchEvent` interface: `{ file: string, event: 'change' | 'add' | 'unlink' }`
- Per-file debounce at 300ms using `setTimeout` — rapid saves collapsed into single event
- `awaitWriteFinish` enabled for Windows compatibility (stabilityThreshold: 100ms)
- Glob include patterns resolved to absolute directory paths for chokidar v5 Windows support
- Exclude patterns converted to RegExp for reliable matching against absolute paths
- File paths normalized to forward-slash relative paths from rootDir in event payloads
- Extension filtering via `scan.fileTypes` in event handler
- 7 new tests (127 total), zero regressions

### File List

- `pixelproof/src/watcher/index.ts` (new)
- `pixelproof/src/watcher/__tests__/watcher.test.ts` (new)
- `pixelproof/package.json` (modified — added chokidar)

### Change Log

- 2026-03-20: Story 1.8 implemented — FileWatcher with chokidar v5, per-file debounce, Windows-compatible absolute path watching
