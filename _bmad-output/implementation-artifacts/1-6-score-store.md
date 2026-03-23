# Story 1.6: Score Store

Status: review

## Story

As a developer,
I want an in-memory store that holds violations and scores per component,
so that the AST engine, render pipeline, and dashboard all share one canonical scoring data structure.

## Acceptance Criteria

1. `Violation` interface matches architecture spec: `id`, `file`, `line`, `column`, `prop`, `found`, `type`, `nearestToken`, `figmaToken`, `resolvedValue`, `source`, `confidence`
2. `ComponentScore` includes: `file`, `exports`, `tokenCompliance` (number | null), `renderFidelity` (number | null), `renderStatus` ('pending' | 'rendered' | 'error' | 'skipped'), `violations[]`
3. `AggregateScore` includes: `tokenCompliance`, `renderFidelity`, `totalComponents`, `renderedComponents`, `skippedComponents`, `totalViolations`
4. `setViolations(file, violations[], totalProperties)` replaces violations for a component and recalculates its `tokenCompliance` score: `round(((totalProperties - violations.length) / totalProperties) * 100, 1)`
5. `setRenderFidelity(file, score, status)` sets render fidelity for a component
6. `getComponentScore(file)` returns `ComponentScore` for a single component
7. `getAggregateScore()` returns `AggregateScore` across all components — render fidelity aggregate excludes skipped/error components
8. `getAllComponents()` returns all component scores as an array
9. `subscribe(callback)` registers a listener — called on every mutation with `{ type: 'violation' | 'render', file }` payload
10. `subscribe()` returns an unsubscribe function
11. Multiple subscribers supported

## Tasks / Subtasks

- [x] Task 1: Define TypeScript interfaces (AC: #1, #2, #3)
  - [x] 1.1: Create `src/scoring/types.ts` with `Violation`, `ComponentScore`, `AggregateScore`, `ViolationSource`, `ViolationConfidence`, `RenderStatus`, `ScoreEvent`
- [x] Task 2: Implement ScoreStore class (AC: #4, #5, #6, #7, #8, #9, #10, #11)
  - [x] 2.1: Create `src/scoring/store.ts` with `ScoreStore` class
  - [x] 2.2: `setViolations(file, violations, totalProperties)` — replaces violations, computes tokenCompliance
  - [x] 2.3: `setRenderFidelity(file, score, status)` — sets render score and status
  - [x] 2.4: `getComponentScore(file)` — returns ComponentScore or undefined
  - [x] 2.5: `getAggregateScore()` — computes aggregate across all components
  - [x] 2.6: `getAllComponents()` — returns array of all ComponentScore entries
  - [x] 2.7: `subscribe(callback)` — returns unsubscribe function, supports multiple subscribers
  - [x] 2.8: Edge case: totalProperties=0 → tokenCompliance=100.0
- [x] Task 3: Write tests (AC: #1–#11)
  - [x] 3.1: Test setViolations with 3 violations out of 10 → tokenCompliance=70.0
  - [x] 3.2: Test setViolations with 0 violations out of 5 → tokenCompliance=100.0
  - [x] 3.3: Test setViolations with 0 violations out of 0 → tokenCompliance=100.0
  - [x] 3.4: Test setRenderFidelity sets score and status
  - [x] 3.5: Test setRenderFidelity with null score and 'skipped' status
  - [x] 3.6: Test getComponentScore returns correct data
  - [x] 3.7: Test getAggregateScore — render fidelity excludes skipped/error components
  - [x] 3.8: Test getAggregateScore — totalViolations sums across components
  - [x] 3.9: Test getAllComponents returns array of all entries
  - [x] 3.10: Test subscribe fires on setViolations with correct payload
  - [x] 3.11: Test subscribe fires on setRenderFidelity with correct payload
  - [x] 3.12: Test unsubscribe stops receiving events
  - [x] 3.13: Test multiple subscribers all receive events

## Dev Notes

### Existing Project State — DO NOT MODIFY these files

```
pixelproof/
  src/cli/index.ts                          # E1-S1
  src/config/schema.ts                      # E1-S2
  src/config/defaults.ts                    # E1-S2
  src/config/loader.ts                      # E1-S2
  src/tokens/types.ts                       # E1-S3
  src/tokens/resolver.ts                    # E1-S3
  src/tokens/converters/dtcg.ts             # E1-S3
  src/tokens/converters/style-dictionary.ts # E1-S4
  src/tokens/converters/token-studio.ts     # E1-S4
  src/tokens/converters/detect.ts           # E1-S4
  src/tokens/cache.ts                       # E1-S5
  src/tokens/loader.ts                      # E1-S5
```

### Files to Create

```
pixelproof/
  src/scoring/
    types.ts                    # Violation, ComponentScore, AggregateScore interfaces
    store.ts                    # ScoreStore class
  src/scoring/__tests__/
    store.test.ts               # All test cases
```

### Violation Interface (from architecture spec — MANDATORY)

```typescript
export type ViolationSource = 'jsx-style' | 'styled-components' | 'emotion' | 'css-module' | 'vanilla-extract';
export type ViolationConfidence = 'exact' | 'approximate';
export type ViolationType = 'color' | 'spacing' | 'typography' | 'border-radius' | 'shadow';

export interface Violation {
  id: string;               // sha1(file + line + found) — deterministic, dedup-safe
  file: string;              // "src/components/Button/Button.tsx"
  line: number;              // 42
  column: number;            // 12
  prop: string;              // "color"
  found: string;             // "#FF5733"
  type: ViolationType;
  nearestToken: string;      // "var(--color-primary-500)"
  figmaToken: string;        // "colors/primary/500"
  resolvedValue: string;     // "#FF5733"
  source: ViolationSource;
  confidence: ViolationConfidence;
}
```

### ComponentScore Interface

```typescript
export type RenderStatus = 'pending' | 'rendered' | 'error' | 'skipped';

export interface ComponentScore {
  file: string;
  exports: string[];
  tokenCompliance: number | null;
  renderFidelity: number | null;
  renderStatus: RenderStatus;
  violations: Violation[];
}
```

### AggregateScore Interface

```typescript
export interface AggregateScore {
  tokenCompliance: number;     // average across all components with non-null tokenCompliance
  renderFidelity: number;      // average across rendered components only (exclude skipped/error)
  totalComponents: number;
  renderedComponents: number;
  skippedComponents: number;
  totalViolations: number;
}
```

### ScoreStore API

```typescript
export class ScoreStore {
  // Replace violations for a file and recalculate tokenCompliance
  setViolations(file: string, violations: Violation[], totalProperties: number): void;

  // Set render fidelity score and status for a file
  setRenderFidelity(file: string, score: number | null, status: RenderStatus): void;

  // Get score for a single component
  getComponentScore(file: string): ComponentScore | undefined;

  // Get aggregate scores across all components
  getAggregateScore(): AggregateScore;

  // Get all component scores as an array
  getAllComponents(): ComponentScore[];

  // Subscribe to mutations — returns unsubscribe function
  subscribe(callback: (event: ScoreEvent) => void): () => void;
}
```

### ScoreEvent Interface

```typescript
export interface ScoreEvent {
  type: 'violation' | 'render';
  file: string;
}
```

### Token Compliance Formula

```
tokenCompliance = round(((totalProperties - violations.length) / totalProperties) * 100, 1)
```

- `totalProperties` = count of style properties with extractable static values
- Edge case: `totalProperties === 0` → `tokenCompliance = 100.0` (no properties = no violations possible)
- Use `Math.round(value * 10) / 10` for 1-decimal rounding

### Aggregate Score Calculation

```typescript
// tokenCompliance: average of all non-null tokenCompliance values
// renderFidelity: average of renderFidelity where renderStatus === 'rendered'
// renderedComponents: count where renderStatus === 'rendered'
// skippedComponents: count where renderStatus === 'skipped' or 'error'
// totalViolations: sum of all violations.length across components
```

If no components have tokenCompliance, aggregate tokenCompliance = 0.
If no components are rendered, aggregate renderFidelity = 0.

### ScoreStore is NOT a Singleton

Create as a regular class (not singleton). The consumer instantiates it. This keeps testing simple — each test creates a fresh instance.

### Violation ID Generation

`id = sha1(file + line + found)` — deterministic, dedup-safe.

Use Node.js built-in `crypto.createHash('sha1')`:
```typescript
import { createHash } from 'node:crypto';

function violationId(file: string, line: number, found: string): string {
  return createHash('sha1').update(`${file}${line}${found}`).digest('hex');
}
```

Note: The Violation `id` is typically generated by the AST scanner (E3), not by ScoreStore. ScoreStore receives pre-built Violation objects. The `violationId` helper can be exported from `types.ts` for the AST scanner to use later.

### ES Modules

Project uses `"type": "module"`. All imports must use `.js` extension:
```typescript
import type { Violation, ComponentScore } from './types.js';
```

### Testing Framework

Vitest. Run with `npx vitest run` from `pixelproof/` directory.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- `Violation` interface matching architecture spec exactly — all 12 fields including `id`, `source`, `confidence`
- `ViolationSource`, `ViolationConfidence`, `ViolationType`, `RenderStatus` type unions
- `ComponentScore` with `tokenCompliance` (number | null), `renderFidelity` (number | null), `renderStatus`, `violations[]`
- `AggregateScore` with averages computed correctly — render fidelity excludes skipped/error
- `violationId()` helper using `crypto.createHash('sha1')` for deterministic IDs
- `ScoreStore` class with `setViolations`, `setRenderFidelity`, `getComponentScore`, `getAggregateScore`, `getAllComponents`
- Pub/sub via `subscribe()` returning unsubscribe function — supports multiple listeners
- Token compliance formula: `round(((N - violations) / N) * 100, 1)` with 0-property edge case → 100.0
- 15 new tests (100 total), zero regressions

### File List

- `pixelproof/src/scoring/types.ts` (new)
- `pixelproof/src/scoring/store.ts` (new)
- `pixelproof/src/scoring/__tests__/store.test.ts` (new)

### Change Log

- 2026-03-20: Story 1.6 implemented — Violation/ComponentScore/AggregateScore types, ScoreStore with pub/sub, violationId helper
