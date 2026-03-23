# Story 1.1: CLI Scaffold + Package Structure

Status: review

## Story

As a developer,
I want to run `npx pixelproof --help` and see the three core commands (`start`, `sync`, `install`),
so that the CLI entry point and npm package skeleton are established for all downstream features.

## Acceptance Criteria

1. `npx pixelproof --help` prints usage with three commands: `start`, `sync`, `install` — each with a one-line description
2. `npx pixelproof --version` prints the version from package.json (initially `0.1.0`)
3. `npx pixelproof start` prints `"Starting PixelProof..."` and exits with code 0 (stub)
4. `npx pixelproof sync` prints `"Syncing tokens..."` and exits with code 0 (stub)
5. `npx pixelproof install` prints `"Installing Playwright Chromium..."` and exits with code 0 (stub)
6. Unknown command (e.g., `npx pixelproof badcommand`) prints error + help text, exits with non-zero code
7. TypeScript compiles to `dist/` without errors
8. `engines` field in package.json requires Node >= 18
9. `.gitignore` includes `node_modules/`, `dist/`, `.pixelproof/`

## Tasks / Subtasks

- [x] Task 1: Initialize npm package and install dependencies (AC: #7, #8)
  - [x] 1.1: Create `package.json` with correct fields (see Dev Notes for exact structure)
  - [x] 1.2: Create `tsconfig.json` targeting ES2022 / NodeNext
  - [x] 1.3: Install dev dependencies: `typescript`, `@types/node`, `commander`
  - [x] 1.4: Install test framework: `vitest` (project standard)
  - [x] 1.5: Create `.gitignore` with `node_modules/`, `dist/`, `.pixelproof/`
- [x] Task 2: Create CLI entry point and Commander.js command definitions (AC: #1, #2, #3, #4, #5, #6)
  - [x] 2.1: Create `bin/pixelproof.js` with hashbang and import of compiled CLI
  - [x] 2.2: Create `src/cli/index.ts` with Commander.js program setup
  - [x] 2.3: Add `start` command — stub that prints message and exits 0
  - [x] 2.4: Add `sync` command — stub that prints message and exits 0
  - [x] 2.5: Add `install` command — stub that prints message and exits 0
  - [x] 2.6: Configure Commander.js for version (from package.json) and unknown command error handling
- [x] Task 3: Verify TypeScript compilation (AC: #7)
  - [x] 3.1: Run `npx tsc` — must produce `dist/` output with zero errors
  - [x] 3.2: Verify `bin/pixelproof.js` can invoke compiled output
- [x] Task 4: Write tests for all CLI commands (AC: #1–#6)
  - [x] 4.1: Test `--help` output contains `start`, `sync`, `install` with descriptions
  - [x] 4.2: Test `--version` outputs version matching package.json
  - [x] 4.3: Test each stub command prints expected message and exits 0
  - [x] 4.4: Test unknown command prints error + help, exits non-zero

## Dev Notes

### Product Context

**PixelProof** is a developer-first `devDependency` that validates React component implementations against Figma design specifications. It delivers two scores per component: Token Compliance % (AST analysis) and Render Fidelity % (Playwright visual diff). v1.0 is local-only — no CI, no cloud.

This story creates the foundation package that every subsequent epic plugs into. After this story, the package exists but does nothing beyond printing stub messages.

### Architecture — Package Structure (MANDATORY)

The final package structure from the architecture document is shown below. **This story only creates the files marked with `<<< CREATE`**. All other paths are listed for awareness only — do NOT create them.

```
pixelproof/
  bin/
    pixelproof.js          <<< CREATE — CLI entry, hashbang, imports dist/cli/index.js
  src/
    cli/
      index.ts             <<< CREATE — Commander.js: start, sync, install stubs
    ast/                   # (future — E3)
    tokens/                # (future — E1-S3+)
    render/                # (future — E5)
    scoring/               # (future — E1-S6)
    dashboard/             # (future — E6)
    ipc/                   # (future — E6)
  dist/                    # TypeScript compilation output — gitignored
  package.json             <<< CREATE
  tsconfig.json            <<< CREATE
  .gitignore               <<< CREATE
```

### package.json — Required Fields

```json
{
  "name": "pixelproof",
  "version": "0.1.0",
  "description": "Catch token violations before code review. Figma-connected. No Storybook required.",
  "type": "module",
  "bin": {
    "pixelproof": "./bin/pixelproof.js"
  },
  "main": "./dist/cli/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": ["design-tokens", "figma", "react", "design-system", "lint"],
  "license": "MIT"
}
```

- `type: "module"` is required — the project uses ES modules throughout.
- `commander` is a runtime dependency (not dev).
- `typescript`, `@types/node`, `vitest` are devDependencies.

### tsconfig.json — Required Settings

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### bin/pixelproof.js — Required Format

```js
#!/usr/bin/env node
import '../dist/cli/index.js';
```

- Must have the `#!/usr/bin/env node` hashbang on line 1.
- Imports the compiled JS from `dist/`, not the TS source.

### src/cli/index.ts — Implementation Guide

Use `commander` npm package (latest stable, currently v12.x). Key implementation:

```typescript
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('pixelproof')
  .description('Catch token violations before code review. Figma-connected. No Storybook required.')
  .version(pkg.version);

program
  .command('start')
  .description('Start PixelProof — scan components and launch dashboard')
  .action(() => {
    console.log('Starting PixelProof...');
  });

program
  .command('sync')
  .description('Sync design tokens from Figma')
  .action(() => {
    console.log('Syncing tokens...');
  });

program
  .command('install')
  .description('Install Playwright Chromium for render fidelity scoring')
  .action(() => {
    console.log('Installing Playwright Chromium...');
  });

program.parse();
```

**Important:** Commander.js automatically handles `--help` and `--version`. Unknown commands trigger an error + help display by default. Do not add custom error handling for unknown commands unless Commander's default behavior doesn't produce a non-zero exit code — in that case, use `program.showHelpAfterError(true)` and handle via the `command:*` event or `program.on('command:*')`.

### Testing Strategy

Use **vitest** as the test framework (project standard for all PixelProof tests).

**How to test CLI commands:** Spawn the CLI as a child process using `node:child_process` `execFile` or `exec`. Run `node bin/pixelproof.js <args>` and assert on:
- stdout content
- exit code (via `error.code` for non-zero, or null error for zero)

Place tests in `src/cli/__tests__/cli.test.ts`.

**Test cases to implement:**

| Test | Command | Assert stdout contains | Assert exit code |
|------|---------|----------------------|-----------------|
| help output | `--help` | `start`, `sync`, `install`, each with description text | 0 |
| version output | `--version` | `0.1.0` | 0 |
| start stub | `start` | `Starting PixelProof...` | 0 |
| sync stub | `sync` | `Syncing tokens...` | 0 |
| install stub | `install` | `Installing Playwright Chromium...` | 0 |
| unknown command | `badcommand` | error message (exact wording may vary) | non-zero |

### .gitignore Content

```
node_modules/
dist/
.pixelproof/
```

### What This Story Does NOT Include

- No config loading (E1-S2)
- No token parsing (E1-S3+)
- No actual scanning, rendering, or scoring
- No dashboard
- No Figma API calls
- Commands are stubs only — they print a message and exit

### Project Structure Notes

- This story creates the `pixelproof/` package at the project root: `d:\Projects\design-dev-automator\pixelproof\`
- All paths in this story are relative to the `pixelproof/` directory unless stated otherwise
- The package is an ES module (`"type": "module"`) — use `import`/`export`, not `require`/`module.exports`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Q1 — Repo and Folder Structure]
- [Source: _bmad-output/planning-artifacts/stories/epic-01-foundation.md#E1-S1]
- [Source: _bmad-output/project-context.md#Tech Stack]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered. All tasks completed in a single pass.

### Completion Notes List

- Created npm package skeleton with ES module configuration (`"type": "module"`)
- Commander.js v14.0.3 installed as runtime dependency; TypeScript 5.9.3, vitest 4.1.0 as devDependencies
- CLI entry `bin/pixelproof.js` with hashbang invokes compiled `dist/cli/index.js`
- Three stub commands: `start`, `sync`, `install` — each prints message and exits 0
- `--help` and `--version` handled automatically by Commander.js
- Unknown commands produce error + help text and exit code 1 via `showHelpAfterError(true)`
- All 9 acceptance criteria verified manually
- 6/6 vitest tests pass (help, version, start, sync, install, unknown command)

### File List

- `pixelproof/package.json` (new)
- `pixelproof/tsconfig.json` (new)
- `pixelproof/.gitignore` (new)
- `pixelproof/bin/pixelproof.js` (new)
- `pixelproof/src/cli/index.ts` (new)
- `pixelproof/src/cli/__tests__/cli.test.ts` (new)

### Change Log

- 2026-03-20: Story 1.1 implemented — CLI scaffold with 3 stub commands, full test suite, TypeScript compilation verified
