# Story 1.2: Configuration Loader

Status: review

## Story

As a developer,
I want PixelProof to automatically find and parse my `.pixelproofrc` config file (JSON or YAML), interpolate environment variables, and merge with sensible defaults,
so that all downstream modules receive a fully typed configuration object without manual wiring.

## Acceptance Criteria

1. Finds `.pixelproofrc` (no extension), `.pixelproofrc.json`, `.pixelproofrc.yaml`, `.pixelproofrc.yml` — first match wins, searched in that order
2. Parses JSON and YAML formats correctly
3. Interpolates `${ENV_VAR}` patterns in string values with `process.env` values
4. Missing env var referenced in config throws descriptive error: `"Environment variable FIGMA_PAT is not set (referenced in figma.personalAccessToken)"`
5. Missing optional fields use defaults (see defaults table below)
6. Missing required field (`figma.fileId` when `figma.personalAccessToken` is present) throws validation error
7. No `.pixelproofrc` found returns config with all defaults (`figma` section undefined) — local-only mode
8. Returns a fully typed `PixelProofConfig` object

## Tasks / Subtasks

- [x] Task 1: Define TypeScript interfaces and defaults (AC: #5, #8)
  - [x] 1.1: Create `src/config/schema.ts` with `PixelProofConfig` and nested interfaces
  - [x] 1.2: Create `src/config/defaults.ts` with default values for all optional fields
- [x] Task 2: Implement config file discovery and parsing (AC: #1, #2, #3, #4)
  - [x] 2.1: Create `src/config/loader.ts` with `findConfig()` — searches for config files in priority order
  - [x] 2.2: Implement `parseConfig()` — detects JSON vs YAML, parses content
  - [x] 2.3: Implement `interpolateEnvVars()` — recursively walks config object, replaces `${VAR}` patterns
  - [x] 2.4: Implement `mergeDefaults()` — deep merges user config with defaults
  - [x] 2.5: Implement `loadConfig(rootDir?)` — orchestrator: find → parse → interpolate → validate → merge → return typed config
- [x] Task 3: Implement validation (AC: #6, #7)
  - [x] 3.1: Validate `figma.fileId` is present when `figma.personalAccessToken` is set
  - [x] 3.2: Handle missing config file gracefully — return defaults with no figma section
- [x] Task 4: Install `js-yaml` dependency
  - [x] 4.1: `npm install js-yaml` and `npm install --save-dev @types/js-yaml`
- [x] Task 5: Write tests (AC: #1–#8)
  - [x] 5.1: Test valid `.pixelproofrc.yaml` with all fields returns fully populated config
  - [x] 5.2: Test `.pixelproofrc.json` with only `figma.fileId` fills remaining with defaults
  - [x] 5.3: Test `${FIGMA_PAT}` interpolation when env var is set
  - [x] 5.4: Test `${FIGMA_PAT}` interpolation when env var is NOT set throws descriptive error
  - [x] 5.5: Test no config file returns all defaults with figma undefined
  - [x] 5.6: Test invalid YAML throws parse error
  - [x] 5.7: Test config discovery priority order (`.pixelproofrc` wins over `.pixelproofrc.json`)
  - [x] 5.8: Test validation: figma.personalAccessToken without figma.fileId throws error

## Dev Notes

### Architecture — Config Shape

The config file `.pixelproofrc` (JSON or YAML) at project root has this structure:

```yaml
figma:
  fileId: "abc123..."
  personalAccessToken: "${FIGMA_PAT}"   # env var reference — never hardcode
  syncTTL: 86400                        # seconds, default 24h

scan:
  include: ["src/components/**", "src/features/**"]
  exclude: ["**/*.test.tsx", "**/*.stories.tsx", "**/node_modules/**"]
  fileTypes: ["tsx", "ts", "jsx", "js", "css", "scss"]

tokens:
  format: "dtcg"                        # "dtcg" | "style-dictionary" | "token-studio"
  fallbackDir: "tokens/"

dashboard:
  port: 3001

render:
  enabled: true
  viewport: { width: 1440, height: 900 }
  tolerance: 4                          # pixel tolerance (ADR-OQ-06: 4px default)
  theme: "light"                        # "light" | "dark" | "system"
  components:
    DataTable:
      mockProps: "./mocks/DataTable.mock.ts"
```

### Default Values (MANDATORY)

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

### TypeScript Interfaces — Required Shape

```typescript
export interface FigmaConfig {
  fileId: string;
  personalAccessToken: string;
  syncTTL: number;
}

export interface ScanConfig {
  include: string[];
  exclude: string[];
  fileTypes: string[];
}

export interface TokensConfig {
  format: 'dtcg' | 'style-dictionary' | 'token-studio';
  fallbackDir: string;
}

export interface DashboardConfig {
  port: number;
}

export interface ViewportConfig {
  width: number;
  height: number;
}

export interface ComponentRenderConfig {
  mockProps: string;
}

export interface RenderConfig {
  enabled: boolean;
  viewport: ViewportConfig;
  tolerance: number;
  theme: 'light' | 'dark' | 'system';
  components?: Record<string, ComponentRenderConfig>;
}

export interface PixelProofConfig {
  figma?: FigmaConfig;        // undefined = local-only mode, no Figma
  scan: ScanConfig;
  tokens: TokensConfig;
  dashboard: DashboardConfig;
  render: RenderConfig;
}
```

### Implementation Details

**Config discovery order** (first match wins):
1. `.pixelproofrc` (extensionless — try JSON parse first, then YAML)
2. `.pixelproofrc.json`
3. `.pixelproofrc.yaml`
4. `.pixelproofrc.yml`

**Env var interpolation:** Recursively walk all string values. Replace `${VAR_NAME}` with `process.env.VAR_NAME`. If env var is undefined, throw with message: `"Environment variable VAR_NAME is not set (referenced in <dot.path.to.field>)"`. Only interpolate strings — don't touch numbers, booleans, arrays of non-strings.

**Validation rules:**
- If `figma.personalAccessToken` is present, `figma.fileId` MUST also be present
- If no figma section at all, that's fine — local-only mode
- `tokens.format` must be one of: `"dtcg"`, `"style-dictionary"`, `"token-studio"`
- `render.theme` must be one of: `"light"`, `"dark"`, `"system"`

**Deep merge strategy:** User config overrides defaults at the leaf level. Arrays replace entirely (no merging array elements). Undefined sections use full default.

### Dependencies

- `js-yaml` — runtime dependency for YAML parsing
- `@types/js-yaml` — devDependency

### Existing Files (from E1-S1)

```
pixelproof/
  bin/pixelproof.js           # CLI entry — DO NOT MODIFY
  src/cli/index.ts            # Commander.js — DO NOT MODIFY (will be wired in a future story)
  package.json                # ADD js-yaml dependency
  tsconfig.json               # NO CHANGES NEEDED
  .gitignore                  # NO CHANGES NEEDED
```

### Files to Create

```
pixelproof/
  src/config/
    schema.ts                 # PixelProofConfig + nested interfaces
    defaults.ts               # DEFAULT_CONFIG constant
    loader.ts                 # findConfig, parseConfig, interpolateEnvVars, mergeDefaults, loadConfig
  src/config/__tests__/
    loader.test.ts            # All test cases
```

### Testing Strategy

Use **vitest**. Tests should use `tmp` directories (via `node:fs/promises` `mkdtemp`) to create temporary config files, run `loadConfig(tmpDir)`, and assert results. Clean up after each test.

**Key patterns:**
- Write config file to temp dir → call `loadConfig(tempDir)` → assert returned config
- Set `process.env.FIGMA_PAT` before test, restore after (use `vi.stubEnv` or manual save/restore)
- For "no config" test: pass an empty temp dir

Place tests in `src/config/__tests__/loader.test.ts`.

### What This Story Does NOT Include

- No wiring config into CLI commands (future story)
- No Figma API calls
- No token parsing or cache
- The `loadConfig()` function is standalone — it will be imported by other modules later

### Project Structure Notes

- All paths relative to `pixelproof/` directory
- ES module project (`"type": "module"`) — use `import`/`export`
- `src/config/schema.ts` exports must be importable by all future modules

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Q1 — Repo and Folder Structure]
- [Source: _bmad-output/planning-artifacts/stories/epic-01-foundation.md#E1-S2]
- [Source: _bmad-output/project-context.md#Configuration — .pixelproofrc]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered. All tasks completed in a single pass.

### Completion Notes List

- `PixelProofConfig` interface with full type hierarchy: FigmaConfig, ScanConfig, TokensConfig, DashboardConfig, RenderConfig
- `DEFAULT_CONFIG` constant covers all optional fields per architecture spec (tolerance=4 per ADR-OQ-06)
- Config discovery: `.pixelproofrc` → `.pixelproofrc.json` → `.pixelproofrc.yaml` → `.pixelproofrc.yml`
- Extensionless files: try JSON parse first, fall back to YAML
- Recursive `${ENV_VAR}` interpolation with descriptive errors including dot-path to offending field
- Deep merge: objects merge recursively, arrays replace entirely
- Validation: `figma.fileId` required when PAT present; `tokens.format` and `render.theme` enum checks
- No config file = local-only mode (all defaults, `figma` undefined)
- `js-yaml` v4.x installed as runtime dependency
- 18 new tests, 24 total passing, zero regressions

### File List

- `pixelproof/src/config/schema.ts` (new)
- `pixelproof/src/config/defaults.ts` (new)
- `pixelproof/src/config/loader.ts` (new)
- `pixelproof/src/config/__tests__/loader.test.ts` (new)
- `pixelproof/package.json` (modified — added js-yaml, @types/js-yaml)

### Change Log

- 2026-03-20: Story 1.2 implemented — Configuration loader with discovery, parsing, env interpolation, validation, and defaults merging
