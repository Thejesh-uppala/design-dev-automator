# Story 3.8: Token Compliance Scoring

Status: review

## Story

As a developer,
I want PixelProof to calculate a Token Compliance percentage from AST scan results,
so that each component and the overall project get a quantified score reflecting how many CSS properties use design tokens.

## Acceptance Criteria

- [x] `calculateTokenCompliance(N, K)` returns `round(((N - K) / N) * 100, 1)` with 1 decimal place
- [x] 0 properties, 0 violations returns 100.0 (perfect score for files with no token-eligible styles)
- [x] N properties, N violations returns 0.0
- [x] N properties, 0 violations returns 100.0
- [x] Fractional results are rounded to 1 decimal (7 properties, 2 violations = 71.4)
- [x] `calculateAggregateCompliance()` averages multiple component scores equally
- [x] Aggregate of empty array returns 0
- [x] Aggregate rounds to 1 decimal place

## Tasks / Subtasks

- [x] Task 1: Implement token compliance scoring
  - [x] 1.1: Create `src/scoring/token-compliance.ts` with `calculateTokenCompliance()` function
  - [x] 1.2: Handle edge case: 0 totalProperties returns 100.0
  - [x] 1.3: Formula: round(((N - K) / N) * 100, 1) using Math.round(raw * 10) / 10
  - [x] 1.4: Implement `calculateAggregateCompliance()` — equal-weight average of component scores
  - [x] 1.5: Handle edge case: empty scores array returns 0
- [x] Task 2: Write tests
  - [x] 2.1: Test 10 properties, 3 violations = 70.0
  - [x] 2.2: Test 10 properties, 0 violations = 100.0
  - [x] 2.3: Test 10 properties, 10 violations = 0.0
  - [x] 2.4: Test 0 properties, 0 violations = 100.0
  - [x] 2.5: Test 7 properties, 2 violations = 71.4
  - [x] 2.6: Test 1 property, 1 violation = 0.0
  - [x] 2.7: Test 100 properties, 1 violation = 99.0
  - [x] 2.8: Test aggregate averages multiple scores
  - [x] 2.9: Test aggregate single score
  - [x] 2.10: Test aggregate empty array = 0
  - [x] 2.11: Test aggregate rounding

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `calculateTokenCompliance(totalProperties, violationCount)` — pure function, formula: round(((N-K)/N)*100, 1)
- Returns 100.0 when totalProperties is 0 (no token-eligible styles = perfect compliance)
- `calculateAggregateCompliance(scores)` — equal-weight average across component scores, returns 0 for empty input
- Both functions round to 1 decimal place using Math.round(raw * 10) / 10
- 11 test cases covering standard calculations, edge cases, and rounding behavior

### File List

- `pixelproof/src/scoring/token-compliance.ts` (new)
- `pixelproof/src/scoring/__tests__/token-compliance.test.ts` (new)

### Change Log

- 2026-03-22: Story 3.8 implemented — token compliance scoring with per-component and aggregate calculations
