# Epic 1: Project Foundation + Config + File Watcher

**Goal:** After E1, `npx pixelproof start` loads config, reads local tokens, discovers components, watches for changes, and stores scores in memory. No Figma, no dashboard, no rendering — just the skeleton that every later epic plugs into.

**Depends on:** Nothing. This is the starting point.
**Unlocks:** E2 (Figma sync) + E3 (AST engine) can start in parallel after E1 completes.

---

## E1-S1: CLI Scaffold + Package Structure

### Description

Set up the npm package skeleton with the folder structure defined in the architecture (Q1). Create the CLI entry point using Commander.js with three subcommands as stubs.

### Files to Create

```
pixelproof/
  bin/pixelproof.js          # CLI entry — hashbang, imports src/cli/index
  src/cli/index.ts           # Commander.js: start, sync, install commands (stub handlers)
  package.json               # name: pixelproof, bin field, type: module
  tsconfig.json              # TypeScript config — target ES2022, module NodeNext
```

### Acceptance Criteria

- [ ] `npx pixelproof --help` prints usage with three commands: `start`, `sync`, `install`
- [ ] `npx pixelproof --version` prints the version from package.json
- [ ] `npx pixelproof start` prints `"Starting PixelProof..."` and exits (stub)
- [ ] `npx pixelproof sync` prints `"Syncing tokens..."` and exits (stub)
- [ ] `npx pixelproof install` prints `"Installing Playwright Chromium..."` and exits (stub)
- [ ] Unknown command prints error + help text
- [ ] TypeScript compiles to `dist/` without errors

### Test Cases

| Input | Expected Output |
|---|---|
| `npx pixelproof --help` | Shows `start`, `sync`, `install` commands with descriptions |
| `npx pixelproof --version` | Prints `0.1.0` (or whatever package.json version is) |
| `npx pixelproof start` | Prints stub message, exits 0 |
| `npx pixelproof badcommand` | Prints error: unknown command, shows help |

### Notes

- Use `commander` npm package
- Node >= 18 required — add `engines` field to package.json
- Add `.gitignore` with `node_modules/`, `dist/`, `.pixelproof/`

---

## E1-S2: Configuration Loader

### Description

Parse `.pixelproofrc` (JSON or YAML) from the project root. Validate required fields, interpolate environment variables (`${FIGMA_PAT}` → `process.env.FIGMA_PAT`), and merge with defaults.

### Files to Create

```
src/config/
  loader.ts          # findConfig(), parseConfig(), mergeDefaults()
  schema.ts          # TypeScript interface for PixelProofConfig + defaults
  defaults.ts        # Default values for all optional fields
```

### Acceptance Criteria

- [ ] Finds `.pixelproofrc` (no extension), `.pixelproofrc.json`, `.pixelproofrc.yaml`, `.pixelproofrc.yml` — first match wins
- [ ] Parses JSON and YAML formats correctly
- [ ] Interpolates `${ENV_VAR}` patterns in string values with `process.env` values
- [ ] Missing env var referenced in config → throws descriptive error: `"Environment variable FIGMA_PAT is not set (referenced in figma.personalAccessToken)"`
- [ ] Missing optional fields use defaults (see table below)
- [ ] Missing required field (`figma.fileId` when Figma sync is intended) → throws validation error
- [ ] No `.pixelproofrc` found → uses all defaults (local-only mode, no Figma)
- [ ] Returns a fully typed `PixelProofConfig` object

### Default Values

| Field | Default |
|---|---|
| `scan.include` | `["src/**"]` |
| `scan.exclude` | `["**/*.test.tsx", "**/*.test.ts", "**/*.stories.tsx", "**/node_modules/**"]` |
| `scan.fileTypes` | `["tsx", "ts", "jsx", "js", "css", "scss"]` |
| `tokens.format` | `"dtcg"` |
| `tokens.fallbackDir` | `"tokens/"` |
| `dashboard.port` | `3001` |
| `render.enabled` | `true` |
| `render.viewport` | `{ width: 1440, height: 900 }` |
| `render.tolerance` | `4` |
| `render.theme` | `"light"` |
| `figma.syncTTL` | `86400` |

### Test Cases

| Input | Expected Output |
|---|---|
| Valid `.pixelproofrc.yaml` with all fields | Fully populated config object |
| `.pixelproofrc.json` with only `figma.fileId` | Remaining fields filled with defaults |
| Config with `${FIGMA_PAT}` and env var set | PAT value interpolated from env |
| Config with `${FIGMA_PAT}` and env var NOT set | Throws: "Environment variable FIGMA_PAT is not set..." |
| No `.pixelproofrc` file exists | Returns config with all defaults, `figma` section empty |
| Invalid YAML syntax | Throws parse error with file path + line number |

### Notes

- Use `js-yaml` for YAML parsing
- Use `cosmiconfig` or similar for config file discovery (optional — manual search is fine too)
- Config type must be exported for use by all other modules

---

## E1-S3: Internal Token Format + DTCG Converter

### Description

Define the internal `TokenMap` data structure used by all downstream consumers (AST scanner, scoring, dashboard). Implement the W3C DTCG JSON parser with full alias chain resolution.

### Files to Create

```
src/tokens/
  types.ts           # TokenMap, TokenEntry, LookupMaps interfaces
  resolver.ts        # resolveAliasChain() — handles 3+ levels, cyclic detection
  converters/
    dtcg.ts          # parseDTCG(json) → TokenMap
```

### Acceptance Criteria

- [ ] `TokenMap` interface includes: `tokens` (keyed by path), `lookupByValue`, `lookupByCssVar`, `version`, `syncedAt`, `source`
- [ ] `TokenEntry` includes: `resolvedValue`, `aliasChain`, `cssVar`, `type` (color | spacing | typography | border-radius | shadow)
- [ ] `parseDTCG()` parses valid W3C DTCG JSON (`$value`, `$type`, `$description` fields)
- [ ] Alias resolution handles 3+ levels deep: `A → B → C → #0050C0`
- [ ] Cyclic alias (`A → B → A`) throws `CyclicAliasError` with the chain path
- [ ] Max depth of 20 enforced — throws on deeper chains
- [ ] `lookupByValue` maps resolved values to array of token paths: `{ "#0050C0": ["colors/brand/primary", "colors/blue/600"] }`
- [ ] `lookupByCssVar` maps CSS variable names to token paths: `{ "--color-brand-primary": "colors/brand/primary" }`
- [ ] CSS variable name derived from token path: `colors/brand/primary` → `--color-brand-primary` (slash → dash)

### Test Cases

| Input | Expected Output |
|---|---|
| `{ "colors": { "primary": { "$value": "#0050C0", "$type": "color" } } }` | `lookupByValue["#0050C0"]` includes `"colors/primary"` |
| Token A `$value: "{colors/blue/600}"`, Token B `$value: "#0050C0"` | A resolves to `#0050C0`, `aliasChain: ["colors/primary", "colors/blue/600"]` |
| 4-level alias chain: A → B → C → D → `#fff` | All 4 tokens resolve to `#fff`, all appear in `lookupByValue["#ffffff"]` |
| Cyclic: A → B → A | Throws `CyclicAliasError` with chain `["A", "B", "A"]` |
| 21-level deep chain | Throws max depth error |
| Token with `$type: "dimension"` and `$value: "16px"` | `type: "spacing"`, `lookupByValue["16px"]` populated |

### Notes

- Normalize hex values: `#fff` → `#ffffff`, always lowercase
- The DTCG `$type` field maps to internal types: `color` → `color`, `dimension` → `spacing`, `fontFamily`/`fontSize`/`fontWeight`/`lineHeight` → `typography`, `borderRadius` → `border-radius`, `shadow` → `shadow`

---

## E1-S4: Style Dictionary + Token Studio Converters

### Description

Implement converters for the two remaining token formats so that local `tokens/` directories using Style Dictionary or Token Studio output produce the same `TokenMap` as DTCG.

### Files to Create

```
src/tokens/converters/
  style-dictionary.ts    # parseStyleDictionary(input) → TokenMap
  token-studio.ts        # parseTokenStudio(json) → TokenMap
```

### Acceptance Criteria

- [ ] **Style Dictionary CSS custom properties:** Parses CSS files containing `--token-name: value;` declarations. Extracts variable name + value. Builds `lookupByValue` and `lookupByCssVar`.
- [ ] **Style Dictionary JS/TS export:** Parses `module.exports` or `export default` objects with nested token structure. Resolves to flat key-value pairs.
- [ ] **Token Studio JSON:** Parses Token Studio's JSON export format (nested object with `value`, `type`, `description` fields — similar to DTCG but with different nesting conventions). Runs through the same alias resolver from E1-S3.
- [ ] All three converters produce identical `TokenMap` structure as DTCG converter
- [ ] Format auto-detection: given a file, detect whether it's DTCG, Style Dictionary CSS, Style Dictionary JS, or Token Studio based on content/extension

### Test Cases

| Input | Expected Output |
|---|---|
| CSS file: `:root { --color-primary: #0050C0; --spacing-4: 16px; }` | `lookupByValue["#0050C0"]` → `["color-primary"]`, `lookupByCssVar["--color-primary"]` → `"color-primary"` |
| JS file: `module.exports = { color: { primary: { value: "#0050C0" } } }` | Same `lookupByValue` as CSS |
| Token Studio JSON with `{ "colors": { "primary": { "value": "{colors.blue.600}", "type": "color" } } }` | Alias resolved, same output format |
| File with `.css` extension containing CSS vars | Auto-detected as Style Dictionary CSS |
| File with `.tokens.json` containing `$value` fields | Auto-detected as DTCG |

### Notes

- Token Studio uses dot notation for aliases (`{colors.blue.600}`) vs DTCG slash notation (`{colors/blue/600}`). Normalize both to internal path format.
- SCSS variables (`$var-name: value;`) are read-only detection — include in `lookupByValue` but mark `source: "scss"`.

---

## E1-S5: Local Token File Loader + Cache Writer

### Description

Read token files from the `tokens/` directory (or configured `tokens.fallbackDir`), auto-detect format, run the appropriate converter, and write the result to `.pixelproof/token-cache.json`. Handle first-run setup (create `.pixelproof/` dir, append to `.gitignore`).

### Files to Create

```
src/tokens/
  loader.ts          # loadLocalTokens(config) → TokenMap
  cache.ts           # readCache(), writeCache(), isCacheFresh()
```

### Acceptance Criteria

- [ ] Scans `tokens.fallbackDir` (default: `tokens/`) for token files (`.json`, `.css`, `.js`, `.ts`)
- [ ] Auto-detects format per file using format detection from E1-S4
- [ ] Merges tokens from multiple files into a single `TokenMap` (additive — no conflicts expected since token paths are unique)
- [ ] Writes merged `TokenMap` to `.pixelproof/token-cache.json` in the cache JSON structure from the architecture
- [ ] Creates `.pixelproof/` directory if it doesn't exist
- [ ] On first run: appends `.pixelproof/` to `.gitignore` (creates `.gitignore` if missing, appends if not already present)
- [ ] `readCache()` reads and returns existing `token-cache.json`
- [ ] `isCacheFresh(syncTTL)` compares `syncedAt` timestamp against TTL — returns boolean
- [ ] `writeCache(tokenMap)` writes with `syncedAt: new Date().toISOString()` and `version: "1"`
- [ ] Empty `tokens/` directory → empty `TokenMap` with zero tokens (not an error)

### Test Cases

| Input | Expected Output |
|---|---|
| `tokens/colors.json` (DTCG) + `tokens/spacing.css` (Style Dictionary) | Merged `token-cache.json` with both color and spacing tokens |
| No `tokens/` directory exists | Empty TokenMap, no error, warning logged |
| `.pixelproof/` doesn't exist | Created automatically |
| `.gitignore` exists without `.pixelproof/` | `.pixelproof/` appended |
| `.gitignore` already contains `.pixelproof/` | Not duplicated |
| Cache written 2 hours ago, TTL = 86400 | `isCacheFresh()` returns true |
| Cache written 25 hours ago, TTL = 86400 | `isCacheFresh()` returns false |

---

## E1-S6: Score Store

### Description

Define the in-memory store that holds violations and scores per component. This is the central data structure that the AST engine writes to (E3), the render pipeline writes to (E5), and the dashboard reads from (E6).

### Files to Create

```
src/scoring/
  store.ts           # ScoreStore class — in-memory, singleton
  types.ts           # Violation, ComponentScore, AggregateScore interfaces
```

### Acceptance Criteria

- [ ] `Violation` interface matches the architecture spec (id, file, line, column, prop, found, type, nearestToken, figmaToken, resolvedValue, source, confidence)
- [ ] `ComponentScore` includes: `file`, `exports`, `tokenCompliance` (number | null), `renderFidelity` (number | null), `renderStatus` ('pending' | 'rendered' | 'error' | 'skipped'), `violations[]`
- [ ] `AggregateScore` includes: `tokenCompliance`, `renderFidelity`, `totalComponents`, `renderedComponents`, `skippedComponents`, `totalViolations`
- [ ] `setViolations(file, violations[], totalProperties)` replaces violations for a component and recalculates its `tokenCompliance` score using the formula `round(((totalProperties - violations.length) / totalProperties) * 100, 1)`
- [ ] `setRenderFidelity(file, score, status)` sets render fidelity for a component
- [ ] `getComponentScore(file)` returns `ComponentScore` for a single component
- [ ] `getAggregateScore()` returns `AggregateScore` across all components — render fidelity aggregate excludes skipped/error components
- [ ] `getAllComponents()` returns all component scores as an array
- [ ] `subscribe(callback)` registers a listener — called on every mutation with `{ type: 'violation' | 'render', file }` payload
- [ ] `subscribe()` returns an unsubscribe function
- [ ] Multiple subscribers supported

### Test Cases

| Input | Expected Output |
|---|---|
| `setViolations('Button.tsx', [3 violations], 10)` | `getComponentScore('Button.tsx').tokenCompliance` = 70.0 |
| `setViolations('Card.tsx', [], 5)` | `tokenCompliance` = 100.0 |
| `setViolations('Empty.tsx', [], 0)` | `tokenCompliance` = 100.0 (edge case: 0 properties = no violations possible) |
| `setRenderFidelity('Button.tsx', 91.2, 'rendered')` | `getComponentScore('Button.tsx').renderFidelity` = 91.2 |
| `setRenderFidelity('Card.tsx', null, 'skipped')` | Card excluded from aggregate renderFidelity |
| Subscribe → mutate → callback fires | Callback receives `{ type: 'violation', file: 'Button.tsx' }` |

### Notes

- The `totalProperties` (N) parameter is required for Token Compliance calculation: `round(((N - violations.length) / N) * 100, 1)`. This is the count of style properties with extractable static values in the scanned file.
- Violation `id` is `sha1(file + line + found)` — deterministic, dedup-safe.

---

## E1-S7: Component Discovery

### Description

Scan the project for React component files matching the configured `scan.include` / `scan.exclude` globs. AST-parse each file to detect exported React components.

### Files to Create

```
src/discovery/
  scanner.ts         # discoverComponents(config) → ComponentEntry[]
  detect-exports.ts  # parseExports(filePath) → ExportedComponent[]
```

### Acceptance Criteria

- [ ] Globs files matching `scan.include` patterns, filtered by `scan.exclude` and `scan.fileTypes`
- [ ] For each matched file, AST-parses to detect React component exports:
  - `export function Button()` → detected
  - `export const Button = () => ...` (returning JSX) → detected
  - `export default function Button()` → detected
  - `export default Button` (where Button is a function/arrow returning JSX) → detected
  - `export { Button }` (named re-export) → detected
- [ ] Non-component exports (plain functions, constants, types) are ignored
- [ ] Returns `ComponentEntry[]` where each entry has `{ file: string, exports: string[] }`
- [ ] `.css` and `.scss` files are included in file list but skip component detection (they have no exports — they're scanned by the AST engine for token violations only)
- [ ] Performance: discovery completes in < 2 seconds for 200 files

### Test Cases

| Input File | Expected Output |
|---|---|
| `export function Button() { return <button /> }` | `{ exports: ['Button'] }` |
| `export const Card = () => <div />` | `{ exports: ['Card'] }` |
| `export default function Modal() { return <div /> }` | `{ exports: ['Modal'] }` (name = 'Modal') |
| `export default () => <div />` | `{ exports: ['default'] }` (anonymous) |
| `export function helper() { return 42 }` | Not detected (no JSX return) |
| `export const CONFIG = { port: 3000 }` | Not detected (not a component) |
| File matching `scan.exclude` pattern | Skipped entirely |

---

## E1-S8: File Watcher

### Description

Watch the project's `scan.include` paths for file changes using chokidar. Debounce rapid saves. Emit change events that the scanner can subscribe to for re-scanning individual files.

### Files to Create

```
src/watcher/
  index.ts           # FileWatcher class — start(), stop(), onChange()
```

### Acceptance Criteria

- [ ] Watches all paths matching `scan.include` globs from config
- [ ] Ignores paths matching `scan.exclude` globs
- [ ] Only watches files matching `scan.fileTypes` extensions
- [ ] Debounces: multiple saves within 300ms produce a single change event
- [ ] `onChange(callback)` registers a handler — receives `{ file: string, event: 'change' | 'add' | 'unlink' }`
- [ ] `start()` begins watching, returns a promise that resolves when watcher is ready
- [ ] `stop()` tears down the watcher cleanly (no lingering file handles)
- [ ] On `unlink` (file deleted): removes component from Score Store

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| Save `Button.tsx` once | Change event fires with `{ file: 'src/components/Button.tsx', event: 'change' }` within 500ms |
| Save `Button.tsx` three times in 100ms | Single change event fires (debounced) |
| Save `Button.test.tsx` | No event (excluded by `scan.exclude`) |
| Save `styles.css` in `src/components/` | Change event fires (CSS is in `scan.fileTypes`) |
| Delete `OldComponent.tsx` | Unlink event fires |
| Call `stop()` | No further events emitted, process can exit cleanly |

### Notes

- Use `chokidar` npm package
- `awaitWriteFinish` option recommended for Windows compatibility (file write locks)
- The watcher does NOT trigger the AST scan itself — it emits events. The CLI `start` command (wired in E3-S9) subscribes and triggers rescans.

---

## E1 Dependency Graph

```
E1-S1 (CLI scaffold)
  ↓
E1-S2 (Config loader)
  ↓
  ├──→ E1-S3 (DTCG converter) ──→ E1-S4 (SD + TS converters) ──→ E1-S5 (Local loader + cache)
  ├──→ E1-S6 (Score Store)     [parallel with S3-S5]
  ├──→ E1-S7 (Component discovery)  [parallel, needs config]
  └──→ E1-S8 (File watcher)   [parallel, needs config]
```

**E1 is complete when:** `npx pixelproof start` loads config, reads local tokens into cache, discovers components, starts watching for file changes, and has an empty Score Store ready for data.
