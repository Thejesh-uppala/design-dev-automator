# Story 1.7: Component Discovery

Status: review

## Story

As a developer,
I want PixelProof to scan my project for React component files matching configured globs and detect exported components via AST parsing,
so that the AST engine and dashboard know which components to analyze.

## Acceptance Criteria

1. Globs files matching `scan.include` patterns, filtered by `scan.exclude` and `scan.fileTypes`
2. For each matched file, AST-parses to detect React component exports:
   - `export function Button()` → detected
   - `export const Button = () => ...` (returning JSX) → detected
   - `export default function Button()` → detected
   - `export default Button` (where Button is a function/arrow returning JSX) → detected
   - `export { Button }` (named re-export) → detected
3. Non-component exports (plain functions, constants, types) are ignored
4. Returns `ComponentEntry[]` where each entry has `{ file: string, exports: string[] }`
5. `.css` and `.scss` files are included in file list but skip component detection (no exports — scanned for token violations only)
6. Performance: discovery completes in < 2 seconds for 200 files

## Tasks / Subtasks

- [x] Task 1: Install required dependencies (AC: #2)
  - [x] 1.1: Add `@babel/parser`, `@babel/traverse`, `@babel/types`, `fast-glob` as dependencies
  - [x] 1.2: Add `@types/babel__traverse` as devDependency
- [x] Task 2: Implement export detection (AC: #2, #3)
  - [x] 2.1: Create `src/discovery/detect-exports.ts` with `parseExports(source, filePath?) → string[]`
  - [x] 2.2: Parse source with `@babel/parser` in TSX mode with plugins: jsx, typescript
  - [x] 2.3: Detect `export function Name()` returning JSX
  - [x] 2.4: Detect `export const Name = () => JSX` (arrow functions)
  - [x] 2.5: Detect `export default function Name()`
  - [x] 2.6: Detect `export default () => JSX` (anonymous → 'default')
  - [x] 2.7: Detect `export { Name }` named re-exports
  - [x] 2.8: Filter out non-component exports (no JSX return)
- [x] Task 3: Implement component scanner (AC: #1, #4, #5)
  - [x] 3.1: Create `src/discovery/scanner.ts` with `discoverComponents(rootDir, scanConfig) → ComponentEntry[]`
  - [x] 3.2: Use `fast-glob` to match `scan.include` patterns, filter by `scan.exclude`
  - [x] 3.3: Filter by `scan.fileTypes` extensions
  - [x] 3.4: For `.css`/`.scss` files: include in result with empty exports array
  - [x] 3.5: For JS/TS files: run `parseExports()` to detect components
- [x] Task 4: Write tests (AC: #1–#5)
  - [x] 4.1: Test `export function Button() { return <button /> }` → ['Button']
  - [x] 4.2: Test `export const Card = () => <div />` → ['Card']
  - [x] 4.3: Test `export default function Modal() { return <div /> }` → ['Modal']
  - [x] 4.4: Test `export default () => <div />` → ['default']
  - [x] 4.5: Test `export function helper() { return 42 }` → [] (no JSX)
  - [x] 4.6: Test `export const CONFIG = { port: 3000 }` → [] (not a component)
  - [x] 4.7: Test scanner respects include/exclude globs
  - [x] 4.8: Test scanner includes CSS files with empty exports
  - [x] 4.9: Test `export { Button }` named re-export detection

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
```

### Files to Create

```
pixelproof/
  src/discovery/
    detect-exports.ts           # parseExports(source) → string[]
    scanner.ts                  # discoverComponents(rootDir, scanConfig) → ComponentEntry[]
  src/discovery/__tests__/
    detect-exports.test.ts      # Export detection tests
    scanner.test.ts             # Scanner integration tests
```

### New Dependencies

```
dependencies:
  @babel/parser          # Parse JS/TS/JSX/TSX source into AST
  @babel/traverse        # Walk AST nodes
  @babel/types           # Type guards for AST nodes (isJSXElement, etc.)
  fast-glob              # Fast file globbing with include/exclude

devDependencies:
  @types/babel__traverse # TypeScript types for @babel/traverse
```

These are part of the architecture's locked tech stack (`@babel/parser` + `@babel/traverse`).

### ScanConfig Interface (from `src/config/schema.ts`)

```typescript
export interface ScanConfig {
  include: string[];   // e.g., ['src/**']
  exclude: string[];   // e.g., ['**/*.test.tsx', '**/*.stories.tsx', '**/node_modules/**']
  fileTypes: string[]; // e.g., ['tsx', 'ts', 'jsx', 'js', 'css', 'scss']
}
```

### ComponentEntry Interface

```typescript
export interface ComponentEntry {
  file: string;        // relative path from rootDir: 'src/components/Button.tsx'
  exports: string[];   // ['Button', 'ButtonIcon'] — empty for CSS files
}
```

### Export Detection Strategy

Use `@babel/parser` to parse source into AST, then `@babel/traverse` to find exports.

**JSX detection:** A function is a React component if its body contains a `JSXElement` or `JSXFragment` node (return statement returning JSX). Use `@babel/traverse` to walk the function body and check for JSX nodes.

**Parser config:**
```typescript
import { parse } from '@babel/parser';

const ast = parse(source, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript'],
});
```

**Visitor patterns:**

1. `ExportNamedDeclaration` → check `declaration`:
   - `FunctionDeclaration` → name + check for JSX return
   - `VariableDeclaration` → check each declarator for arrow/function with JSX

2. `ExportDefaultDeclaration` → check `declaration`:
   - `FunctionDeclaration` → name (or 'default' if anonymous) + check JSX
   - `ArrowFunctionExpression` → 'default' + check JSX
   - `Identifier` → look up binding, check if it's a component

3. `ExportNamedDeclaration` with `specifiers` (re-exports):
   - `export { Button }` → include exported name
   - For re-exports, include the name without JSX validation (we can't easily check the source)

### Scanner Algorithm

```typescript
import fg from 'fast-glob';

function discoverComponents(rootDir: string, scanConfig: ScanConfig): ComponentEntry[] {
  // Build glob patterns filtered by fileTypes
  const patterns = scanConfig.include; // e.g., ['src/**']
  const ignore = scanConfig.exclude;

  // Use fast-glob with cwd = rootDir
  const files = fg.sync(patterns, {
    cwd: rootDir,
    ignore,
    onlyFiles: true,
    dot: false,
  });

  // Filter by fileTypes
  const allowedExtensions = scanConfig.fileTypes.map(t => `.${t}`);
  const filtered = files.filter(f => allowedExtensions.some(ext => f.endsWith(ext)));

  const entries: ComponentEntry[] = [];
  for (const file of filtered) {
    const ext = path.extname(file);
    if (ext === '.css' || ext === '.scss') {
      entries.push({ file, exports: [] });
    } else {
      const source = readFileSync(path.resolve(rootDir, file), 'utf-8');
      const exports = parseExports(source);
      entries.push({ file, exports });
    }
  }
  return entries;
}
```

### Testing Pattern — Temp Directories

For scanner tests, create temp directories with actual files:
```typescript
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'pixelproof-discovery-test-'));
```

For export detection tests, pass source strings directly — no file I/O needed.

### ES Modules

Project uses `"type": "module"`. All imports must use `.js` extension for local modules.
`@babel/parser`, `@babel/traverse`, `fast-glob` are imported by package name (no extension).

### Testing Framework

Vitest. Run with `npx vitest run` from `pixelproof/` directory.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed `@babel/traverse` CJS/ESM interop — default export handling for ESM project with CJS package

### Completion Notes List

- `parseExports(source)` — AST-based React component export detection using `@babel/parser` + `@babel/traverse`
- Detects: named function exports, const arrow exports, default exports (named + anonymous), named re-exports (`export { Name }`)
- JSX detection via `functionHasJSX()` — checks both block bodies and expression bodies
- Filters out non-component exports (plain functions returning non-JSX, constants, types)
- `export default Identifier` resolves binding to check if it's a component
- `discoverComponents(rootDir, scanConfig)` — glob-based file discovery with `fast-glob`
- CSS/SCSS files included with empty exports array
- Filters by `scan.fileTypes` extensions
- `ComponentEntry` interface: `{ file: string, exports: string[] }`
- 20 new tests (120 total), zero regressions

### File List

- `pixelproof/src/discovery/detect-exports.ts` (new)
- `pixelproof/src/discovery/scanner.ts` (new)
- `pixelproof/src/discovery/__tests__/detect-exports.test.ts` (new)
- `pixelproof/src/discovery/__tests__/scanner.test.ts` (new)
- `pixelproof/package.json` (modified — added @babel/parser, @babel/traverse, @babel/types, fast-glob, @types/babel__traverse)

### Change Log

- 2026-03-20: Story 1.7 implemented — AST-based React component export detection, glob-based file scanner with include/exclude filtering
