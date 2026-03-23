# Epic 3: AST Engine + Token Compliance Score

**Goal:** After E3, `npx pixelproof start` scans all React/CSS source files, detects hardcoded style values that should be design tokens, calculates Token Compliance scores, writes results to the Score Store, and re-scans on file change.

**Depends on:** E1 (config, component discovery, file watcher, score store, token cache)
**Parallel with:** E2 (Figma sync). E3 uses the `TokenMap` from cache — whether it was populated by E1 local loader or E2 Figma sync is irrelevant.
**Unlocks:** E4 (iframe harness) + E6 (dashboard can display scores)

---

## E3-S1: Whitelist + Value Pattern Matching

### Description

Shared utilities used by all engines: the list of CSS style properties to check, regex patterns to detect raw values, the static whitelist of values to never flag, and the precision mode check against the token map.

### Files to Create

```
src/ast/
  matchers.ts        # CSS_STYLE_PROPS, VALUE_PATTERN, isWhitelisted(), isViolation()
  whitelist.ts       # WHITELIST set + isWhitelisted()
```

### Acceptance Criteria

- [ ] `CSS_STYLE_PROPS`: set of CSS property names that are token-eligible. Includes: `color`, `backgroundColor`, `background`, `borderColor`, `border`, `fill`, `stroke`, `fontSize`, `fontFamily`, `fontWeight`, `lineHeight`, `letterSpacing`, `margin`, `marginTop/Right/Bottom/Left`, `padding`, `paddingTop/Right/Bottom/Left`, `gap`, `rowGap`, `columnGap`, `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `top`, `right`, `bottom`, `left`, `borderRadius`, `borderTopLeftRadius` (etc.), `boxShadow`, `textShadow`, `outline`, `outlineColor`
- [ ] `VALUE_PATTERN`: regex matching raw hardcoded values:
  - Hex: `#[0-9a-fA-F]{3,8}`
  - RGB/RGBA: `rgba?\(\s*\d+`
  - HSL/HSLA: `hsla?\(\s*\d+`
  - Pixel values: `\d+px`
  - Em/rem: `\d+\.?\d*(em|rem)`
- [ ] `WHITELIST`: values never flagged: `transparent`, `inherit`, `currentColor`, `none`, `initial`, `unset`, `revert`, `auto`, `0`, `100%`, `50%`, `white`, `black`, `0px`
- [ ] `isWhitelisted(value)`: returns true if value is in whitelist (case-insensitive)
- [ ] `isViolation(value, prop, tokenMap)`: the core check function:
  1. If `isWhitelisted(value)` → return false
  2. If value doesn't match `VALUE_PATTERN` → return false (dynamic expression, CSS var, etc.)
  3. Normalize value (hex → lowercase 6-digit)
  4. If normalized value NOT in `tokenMap.lookupByValue` → return false (**precision mode**: no ground truth)
  5. Return true — this is a violation
- [ ] `findNearestToken(value, tokenMap)`: given a violation value, returns the token path(s) from `lookupByValue`

### Test Cases

| Input | `isViolation()` Result |
|---|---|
| `value: '#6366f1'`, prop: `color`, `#6366f1` in tokenMap | `true` — violation |
| `value: 'transparent'`, prop: `color` | `false` — whitelisted |
| `value: '#999999'`, prop: `color`, `#999999` NOT in tokenMap | `false` — precision mode, no ground truth |
| `value: 'var(--color-primary)'`, prop: `color` | `false` — CSS var, not a raw value |
| `value: '16px'`, prop: `fontSize`, `16px` in tokenMap | `true` — violation |
| `value: '0'`, prop: `margin` | `false` — whitelisted |
| `value: 'calc(100% - 16px)'`, prop: `width` | `false` — dynamic expression, doesn't match VALUE_PATTERN fully |
| `value: '#fff'`, `#ffffff` in tokenMap | `true` — hex normalized, match found |
| `value: 'rgb(99, 102, 241)'`, `#6366f1` in tokenMap | `true` — RGB converted to hex, match found |

### Notes

- Hex normalization: `#fff` → `#ffffff`, `#FFF` → `#ffffff`, `#aabbcc` → `#aabbcc`
- RGB to hex conversion: `rgb(99, 102, 241)` → `#6366f1`. Needed because Figma tokens store hex but developers may write RGB.
- HSL to hex conversion is nice-to-have for v1.0 — flag as best-effort.

---

## E3-S2: JSX Style Prop Engine

### Description

Detect violations in JSX `style` prop objects: `style={{ color: '#6366f1' }}`.

### Files to Create

```
src/ast/engines/
  jsx-style.ts       # scanJSXStyles(ast, filePath, tokenMap) → { violations[], totalProperties }
```

### Acceptance Criteria

- [ ] Visits `JSXAttribute` nodes where `name.name === 'style'`
- [ ] Value is `JSXExpressionContainer` → unwrap to `ObjectExpression`
- [ ] For each `Property` in the object:
  - `key.name` (or `key.value` for string keys) checked against `CSS_STYLE_PROPS`
  - `value` is `StringLiteral` → extract string value
  - `value` is `NumericLiteral` → convert to string (e.g., `16` on `fontSize` → `"16"`)
  - `value` is `TemplateLiteral` with no expressions → extract raw string
  - `value` is any other expression type → skip (dynamic, can't analyze statically)
- [ ] Runs `isViolation()` on each extracted value
- [ ] On violation, creates `Violation` object with: file, line, column (from AST node `loc`), prop, found, type, nearestToken, figmaToken, resolvedValue, source = `'jsx-style'`, confidence
- [ ] Counts `totalProperties` = number of style properties with extractable static values (not skipped dynamic ones)
- [ ] Handles nested objects: `style={{ ...base, color: '#fff' }}` → only analyzes the `color` property, ignores the spread

### Test Cases

| Input Code | Expected Output |
|---|---|
| `style={{ color: '#6366f1' }}` (token `#6366f1` exists) | 1 violation: `{ prop: 'color', found: '#6366f1', source: 'jsx-style', line: correct }` |
| `style={{ color: 'transparent' }}` | 0 violations (whitelisted) |
| `style={{ color: tokens.primary }}` | 0 violations (dynamic reference, skipped) |
| `style={{ color: '#6366f1', fontSize: '16px' }}` (both in tokenMap) | 2 violations |
| `style={{ color: isActive ? '#6366f1' : '#ccc' }}` | 0 violations (conditional expression, skipped) |
| `style={{ color: '#999' }}` (`#999999` NOT in tokenMap) | 0 violations (precision mode) |
| `style={{ ...baseStyles, color: '#6366f1' }}` | 1 violation on `color`, spread ignored |
| `style={{ margin: 0 }}` | 0 violations (`0` is whitelisted) |
| `style={{ margin: 16 }}` (`16px` in tokenMap) | 1 violation: found = `"16"`, prop = `margin` |

### Notes

- Line numbers from `node.loc.start.line` — verify these are correct in test output
- `NumericLiteral` on spacing properties: `16` likely means `16px`. Append `px` for token lookup when prop is a spacing property.

---

## E3-S3: CSS Modules Engine

### Description

Detect violations in `.module.css` and `.module.scss` files using postcss.

### Files to Create

```
src/ast/engines/
  css-module.ts      # scanCSSModule(fileContent, filePath, tokenMap) → { violations[], totalProperties }
```

### Acceptance Criteria

- [ ] Parses file with `postcss.parse(content, { syntax: postcss-scss })` (handles both CSS and SCSS)
- [ ] Walks `Declaration` nodes
- [ ] For each declaration: `decl.prop` checked against CSS_STYLE_PROPS (converted from camelCase to kebab-case: `backgroundColor` ↔ `background-color`)
- [ ] `decl.value` checked with `isViolation()`
- [ ] Violation line number from `decl.source.start.line`
- [ ] Column from `decl.source.start.column`
- [ ] Counts `totalProperties` = number of declarations with token-eligible props and raw values
- [ ] SCSS variables (`$primary-color`) as values → not flagged (variable reference, not raw)
- [ ] CSS custom property values (`var(--color-primary)`) → not flagged
- [ ] Multi-value declarations: `border: 1px solid #6366f1` → extracts individual values, checks each

### Test Cases

| Input CSS | Expected Output |
|---|---|
| `.btn { color: #6366f1; }` (token exists) | 1 violation: `{ prop: 'color', found: '#6366f1', source: 'css-module' }` |
| `.btn { color: var(--color-primary); }` | 0 violations |
| `.btn { color: $primary; }` (SCSS) | 0 violations (SCSS variable reference) |
| `.btn { border: 1px solid #6366f1; }` (token exists for `#6366f1`) | 1 violation on the color portion |
| `.btn { margin: 0; }` | 0 violations (whitelisted) |
| `.btn { background: transparent; }` | 0 violations (whitelisted) |
| `.btn { font-size: 16px; }` (`16px` in tokenMap) | 1 violation |
| `.btn { color: #999; }` (NOT in tokenMap) | 0 violations (precision mode) |

### Notes

- postcss-scss syntax allows parsing SCSS without full SCSS compilation — we just need the AST, not computed values.
- Multi-value parsing: for `border`, `background`, `box-shadow` — split on spaces and check each segment individually against `VALUE_PATTERN`.

---

## E3-S4: styled-components Engine

### Description

Detect violations in styled-components template literals: `` styled.button`color: #6366f1;` ``

### Files to Create

```
src/ast/engines/
  styled-components.ts  # scanStyledComponents(ast, filePath, tokenMap) → { violations[], totalProperties }
```

### Acceptance Criteria

- [ ] Visits `TaggedTemplateExpression` nodes where tag matches:
  - `styled.tagName` (e.g., `styled.button`, `styled.div`)
  - `styled(Component)` (extending a component)
  - `css` tagged template (from `styled-components`)
- [ ] Extracts `TemplateLiteral` quasi strings (static portions between `${...}` interpolations)
- [ ] Concatenates quasi strings (dynamic `${...}` portions replaced with a placeholder that won't match any CSS property)
- [ ] Parses concatenated CSS string with postcss
- [ ] Walks declarations — same logic as CSS Modules engine (E3-S3)
- [ ] Maps violation line numbers back to original source file: `TemplateLiteral.loc.start.line + declaration offset within template`
- [ ] Source = `'styled-components'`

### Test Cases

| Input Code | Expected Output |
|---|---|
| `` styled.button`color: #6366f1;` `` (token exists) | 1 violation: `{ prop: 'color', source: 'styled-components' }` |
| `` styled.button`color: ${props => props.color};` `` | 0 violations (dynamic interpolation) |
| `` styled.button`background: transparent;` `` | 0 violations (whitelisted) |
| `` styled.button`margin: 16px; color: #6366f1;` `` (both in tokenMap) | 2 violations |
| `` css`font-size: 14px;` `` (`14px` in tokenMap) | 1 violation |
| `` styled(BaseButton)`color: #6366f1;` `` | 1 violation (extending component) |
| `` styled.button`color: ${theme.primary}; border: 1px solid #6366f1;` `` | 1 violation on `border` color, dynamic `color` skipped |

### Notes

- Line number mapping is tricky: the template literal starts at a certain line in the source file, and the violation is N lines into the template. Add the two offsets.
- When a quasi contains no CSS (e.g., just whitespace or comments), skip it.
- Nested selectors in styled-components are valid CSS — postcss handles them.

---

## E3-S5: Emotion Engine

### Description

Detect violations in Emotion's `css` prop (object syntax and template literal syntax) and `styled()` API.

### Files to Create

```
src/ast/engines/
  emotion.ts         # scanEmotion(ast, filePath, tokenMap) → { violations[], totalProperties }
```

### Acceptance Criteria

- [ ] **css prop — object syntax:** `<div css={{ color: '#6366f1' }} />` → same traversal as JSX style prop (ObjectExpression properties)
- [ ] **css prop — template literal:** `<div css={css\`color: #6366f1;\`} />` → same parsing as styled-components (postcss on template quasi strings)
- [ ] **css() call — object syntax:** `css({ color: '#6366f1' })` → traverse ObjectExpression
- [ ] **css() call — template literal:** `` css`color: #6366f1;` `` → same as styled-components template handling
- [ ] **styled() API:** `styled.button({ color: '#6366f1' })` or `` styled.button`color: #6366f1;` `` — same patterns as above
- [ ] Does not double-count violations if a file also uses JSX inline styles — Emotion engine only processes `css` prop and Emotion API calls, not `style` prop
- [ ] Source = `'emotion'`

### Test Cases

| Input Code | Expected Output |
|---|---|
| `<div css={{ color: '#6366f1' }} />` (token exists) | 1 violation: `source: 'emotion'` |
| `` <div css={css`color: #6366f1;`} /> `` | 1 violation |
| `css({ fontSize: '16px' })` (`16px` in tokenMap) | 1 violation |
| `<div css={{ color: theme.primary }} />` | 0 violations (dynamic reference) |
| `<div style={{ color: '#6366f1' }} css={{ margin: '16px' }} />` | Emotion engine reports 1 violation (margin). JSX engine reports 1 (color). No overlap. |

### Notes

- Emotion's `css` prop is detected by `JSXAttribute` where `name.name === 'css'`. This is distinct from `name.name === 'style'` which the JSX engine handles.
- Emotion can be imported from `@emotion/react`, `@emotion/styled`, or `@emotion/css`. Check for any of these imports.

---

## E3-S6: vanilla-extract Engine

### Description

Detect violations in vanilla-extract `.css.ts` files.

### Files to Create

```
src/ast/engines/
  vanilla-extract.ts # scanVanillaExtract(ast, filePath, tokenMap) → { violations[], totalProperties }
```

### Acceptance Criteria

- [ ] Only processes files with `.css.ts` extension
- [ ] Visits `CallExpression` nodes where `callee.name` (or `callee.object.name + callee.property.name`) matches: `style`, `globalStyle`, `recipe`, `styleVariants`, `fontFace`, `keyframes`
- [ ] For `style({ color: '#6366f1' })` → traverse the ObjectExpression argument, same property checking as JSX style prop
- [ ] For `globalStyle('selector', { color: '#6366f1' })` → second argument is the style object
- [ ] For `recipe({ base: { color: '#6366f1' }, variants: { primary: { color: '#fff' } } })` → traverse `base` + all `variants` values recursively
- [ ] For `styleVariants({ primary: { color: '#6366f1' }, secondary: { color: '#ccc' } })` → traverse each variant value
- [ ] Source = `'vanilla-extract'`

### Test Cases

| Input Code | Expected Output |
|---|---|
| `style({ color: '#6366f1' })` (token exists) | 1 violation: `source: 'vanilla-extract'` |
| `globalStyle('.root', { background: '#6366f1' })` | 1 violation |
| `recipe({ base: { color: '#6366f1' }, variants: { size: { lg: { fontSize: '20px' } } } })` (both in tokenMap) | 2 violations |
| `styleVariants({ primary: { color: '#6366f1' } })` | 1 violation |
| `style({ color: vars.primary })` | 0 violations (variable reference) |
| `style({ selectors: { '&:hover': { color: '#6366f1' } } })` | 1 violation (nested selector object) |

### Notes

- vanilla-extract uses nested objects for selectors (`selectors` key), media queries (`@media` key), and pseudo-classes. Recurse into all nested objects.
- vanilla-extract's `vars` and `createThemeContract` are variable references — never flagged.

---

## E3-S7: AST Scanner Orchestrator

### Description

The top-level scanner that globs component files, dispatches each to the correct engine based on file type/content, collects violations, and writes results to the Score Store.

### Files to Create

```
src/ast/
  scanner.ts         # scanAll(config, tokenMap) → void (writes to ScoreStore)
                     # scanFile(filePath, tokenMap) → { violations[], totalProperties }
```

### Acceptance Criteria

- [ ] Globs files from `scan.include`, filtered by `scan.exclude` and `scan.fileTypes`
- [ ] Dispatches to correct engine based on file:
  - `.module.css`, `.module.scss` → CSS Modules engine (E3-S3)
  - `.css.ts` → vanilla-extract engine (E3-S6)
  - `.tsx`, `.jsx`, `.ts`, `.js` → runs JSX style prop engine (E3-S2) first, then checks for styled-components/Emotion imports and runs those engines if detected
- [ ] Import detection for styled-components: file contains `import ... from 'styled-components'` or `import styled from 'styled-components'`
- [ ] Import detection for Emotion: file contains `import { css } from '@emotion/react'` or `import styled from '@emotion/styled'` or JSX has `css` prop
- [ ] Aggregates violations from all engines run on a single file (a file can have both JSX style props AND styled-components)
- [ ] Writes per-file results to Score Store via `setViolations(file, violations, totalProperties)`
- [ ] `scanAll()` processes all files, logs summary: `"Scanned {N} files. {V} violations found."`
- [ ] `scanFile()` processes a single file — used for re-scan on file change

### Test Cases

| Input | Expected Behavior |
|---|---|
| `Button.tsx` with inline styles only | Dispatched to JSX style prop engine (E3-S2) |
| `Card.module.css` | Dispatched to CSS Modules engine (E3-S3) |
| `theme.css.ts` | Dispatched to vanilla-extract engine (E3-S6) |
| `StyledButton.tsx` importing `styled-components` | JSX engine (E3-S2) + styled-components engine (E3-S4) both run |
| `EmotionCard.tsx` with `css` prop | JSX engine (E3-S2) + Emotion engine (E3-S5) both run |
| `utils.ts` with no JSX, no style imports | No engines run, no violations |
| 100-file scan | Completes in < 10 seconds |

### Notes

- Read the file content once, pass to multiple engines if needed — don't re-read for each engine.
- For efficiency: parse the Babel AST once in the scanner and pass the AST to JSX/styled-components/Emotion engines. Only CSS Modules and vanilla-extract need separate parsing.

---

## E3-S8: Token Compliance Scoring

### Description

Calculate Token Compliance percentage per component and aggregate across all components.

### Files to Create

```
src/scoring/
  token-compliance.ts  # calculateTokenCompliance(totalProps, violationCount) → number
```

### Acceptance Criteria

- [ ] Formula: `TokenCompliance = round(((N - K) / N) * 100, 1)` where N = `totalProperties`, K = `violations.length`
- [ ] Edge case: `N === 0` → score = `100.0` (no properties = no violations possible)
- [ ] Score is a number with 1 decimal place: `72.0`, `100.0`, `85.7`
- [ ] Per-component score written to Score Store
- [ ] Aggregate score: average of all component scores (each component weighted equally)
- [ ] Components with 0 scannable properties (N=0) still count as 100% in aggregate

### Test Cases

| N (total properties) | K (violations) | Expected Score |
|---|---|---|
| 10 | 3 | 70.0 |
| 10 | 0 | 100.0 |
| 10 | 10 | 0.0 |
| 0 | 0 | 100.0 |
| 7 | 2 | 71.4 |
| 1 | 1 | 0.0 |
| 100 | 1 | 99.0 |

### Notes

- This is a pure function — no side effects. The scanner orchestrator (E3-S7) calls this and writes the result to Score Store.
- Flat scoring: all violation types weighted equally (ADR-OQ-03 decision).

---

## E3-S9: CLI Integration — Scan + Watch Loop

### Description

Wire the AST scanner into the `npx pixelproof start` command. On startup: full scan. On file change: re-scan the changed file. Print results to stdout.

### Files to Modify

```
src/cli/index.ts     # Wire start command to scanner + watcher
```

### Acceptance Criteria

- [ ] `npx pixelproof start` performs these steps in order:
  1. Load config (E1-S2)
  2. Load token cache — from cache file or local tokens (E1-S5)
  3. Discover components (E1-S7)
  4. Full AST scan of all discovered files (this epic's scanner)
  5. Print summary: `"Scanned {N} files. Token Compliance: {X}%. {V} violations found."`
  6. Start file watcher (E1-S8)
  7. On file change: re-scan changed file only, print updated score
- [ ] Single-file re-scan prints: `"Rescanned {file}. Token Compliance: {X}% ({+/-} change). {V} violations."`
- [ ] Score Store is updated on every scan — ready for dashboard to read (E6)
- [ ] Ctrl+C exits cleanly (watcher stopped, process exits 0)
- [ ] If no token cache and no local tokens → warn: `"No token data available. Run 'npx pixelproof sync' or add token files to tokens/"` and scan anyway (violations will be empty due to precision mode)
- [ ] Violations also printed to stdout in the violation format from the architecture:
  ```
  [VIOLATION] src/components/Button/Button.tsx:42
    Found: color="#FF5733"
    Expected token: var(--color-primary-500)
  ```

### Test Cases

| Scenario | Expected Output |
|---|---|
| Project with 5 files, 3 have violations | Summary with correct count and score |
| Save `Button.tsx` (has violation) | Re-scan prints updated score for Button |
| Save `Button.test.tsx` | No re-scan (excluded file) |
| No token cache exists | Warning printed, scan completes with 0 violations |
| Ctrl+C during watch | Clean exit, no errors |

---

## E3 Dependency Graph

```
E3-S1 (Whitelist + matchers)
  ↓
  ├──→ E3-S2 (JSX style prop)    ─┐
  ├──→ E3-S3 (CSS Modules)       ─┤
  ├──→ E3-S4 (styled-components) ─┤──→ E3-S7 (Scanner orchestrator) ──→ E3-S8 (Scoring) ──→ E3-S9 (CLI integration)
  ├──→ E3-S5 (Emotion)           ─┤
  └──→ E3-S6 (vanilla-extract)   ─┘
```

Build order: S1 first, then S2-S6 (five engines — independent, any order or parallel), then S7 (orchestrator imports engines), then S8 (scoring), then S9 (CLI wiring).

**E3 is complete when:** `npx pixelproof start` scans all source files across all 5 CSS-in-JS patterns, reports violations with file+line detail, calculates Token Compliance scores, and re-scans on file save.
