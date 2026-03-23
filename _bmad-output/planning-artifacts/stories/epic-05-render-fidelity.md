# Epic 5: Playwright + Render Fidelity Score

**Goal:** After E5, PixelProof captures Playwright screenshots of rendered components, fetches Figma reference images for mapped components, runs pixel diffs with pixelmatch, and calculates Render Fidelity scores. Scores are written to the Score Store for the dashboard to display.

**Depends on:** E4 (iframe harness must be running to render components for screenshots)
**Unlocks:** E6 (dashboard displays render fidelity scores + diff viewer)

---

## E5-S1: Playwright Setup + Chromium Install

### Description

Implement the `npx pixelproof install` CLI command that downloads Playwright's Chromium browser on first use. Chromium is NOT downloaded on `npm install` — only when explicitly triggered.

### Files to Create

```
src/render/
  playwright-setup.ts  # installChromium(), isChromiumInstalled()
```

### Files to Modify

```
src/cli/index.ts       # Wire `install` command
```

### Acceptance Criteria

- [ ] `npx pixelproof install` downloads Playwright Chromium to a local cache directory
- [ ] Uses Playwright's `browserType.install()` or equivalent API — not a shell exec of `npx playwright install chromium`
- [ ] Shows download progress: `"Downloading Chromium... (125 MB)"`
- [ ] On completion: `"Chromium installed successfully."`
- [ ] `isChromiumInstalled()` returns true if Chromium binary exists at expected path
- [ ] Second run of `npx pixelproof install`: detects existing binary, skips download: `"Chromium already installed."`
- [ ] If Chromium is missing when `npx pixelproof start` runs with `render.enabled: true`: prints `"Chromium not found. Run 'npx pixelproof install' first."` and continues with AST-only mode (render fidelity disabled)
- [ ] Chromium is stored in `.pixelproof/browsers/` or Playwright's default cache — NOT in `node_modules`
- [ ] `npm install --save-dev pixelproof` does NOT trigger a Chromium download (install size < 50MB without Chromium)

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| First `npx pixelproof install` | Downloads Chromium, shows progress, success message |
| Second `npx pixelproof install` | Skips download: "already installed" |
| `npx pixelproof start` without Chromium installed | Warning, AST-only mode, render fidelity disabled |
| `npx pixelproof start` with Chromium installed | Full mode: AST + render fidelity |

---

## E5-S2: Figma Reference Image Fetch

### Description

Fetch reference PNG images for components mapped in `.pixelproofrc` `nodeIds`. These serve as the "ground truth" for pixel comparison.

### Files to Create

```
src/render/
  figma-images.ts    # fetchReferenceImages(config, nodeIds) → Map<componentName, imagePath>
```

### Acceptance Criteria

- [ ] Reads `figma.nodeIds` from config: `{ Button: "123:456", Card: "123:789" }`
- [ ] For each mapped component, fetches the Figma node as PNG:
  - **Via MCP:** Uses Figma MCP to export node as image
  - **Via REST API:** `GET /v1/images/:file_key?ids=123:456&format=png&scale=2`
- [ ] Saves images to `.pixelproof/baselines/{ComponentName}.png`
- [ ] Image dimensions match `render.viewport` config (default 1440x900) — uses `scale` parameter to match
- [ ] Respects cache: if baseline image exists and token cache is fresh, skips re-fetch
- [ ] `npx pixelproof sync` also refreshes baseline images (alongside token sync)
- [ ] Components NOT in `nodeIds` mapping → no reference image → render fidelity skipped for that component with message: `"No Figma nodeId mapped for {Component} — add to figma.nodeIds in .pixelproofrc"`
- [ ] Returns a map: component name → local image file path

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| `nodeIds: { Button: "123:456" }`, MCP available | Fetches via MCP, saves `baselines/Button.png` |
| `nodeIds: { Button: "123:456" }`, MCP unavailable, PAT set | Fetches via REST API |
| Component not in `nodeIds` | No image fetched, logged as info (not error) |
| Baseline exists and cache is fresh | Skip re-fetch |
| `npx pixelproof sync --force` | Re-fetches all baselines |
| Invalid nodeId (Figma returns 404) | Warning: "Figma node 123:456 not found for Button" |

### Notes

- Batch node IDs into a single Figma API call where possible (REST API supports comma-separated IDs)
- Image fetching runs in parallel for performance (Promise.all with concurrency limit of 5)

---

## E5-S3: Screenshot Capture

### Description

Use Playwright to capture screenshots of rendered components from the iframe harness.

### Files to Create

```
src/render/
  playwright-runner.ts  # captureScreenshot(component, config) → screenshotPath
```

### Acceptance Criteria

- [ ] Launches Playwright Chromium in headless mode
- [ ] Navigates to `localhost:{port}/harness?component={file}&export={exportName}`
- [ ] Waits for component to render: `page.waitForSelector('#pixelproof-root > *')` with 10-second timeout
- [ ] Sets viewport to `render.viewport` dimensions (default 1440x900)
- [ ] Captures screenshot of `#pixelproof-root` element (component only, not full page)
- [ ] Saves to `.pixelproof/screenshots/{ComponentName}.png`
- [ ] If component render fails (ErrorBoundary triggered): detects error state, skips screenshot, marks `renderStatus: 'error'`
- [ ] Per-component screenshot: < 5 seconds
- [ ] Browser instance is reused across components (launch once, capture many) for performance
- [ ] `close()` method kills Playwright browser cleanly

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| Component renders successfully | Screenshot saved to `screenshots/Button.png` |
| Component throws (ErrorBoundary) | Screenshot skipped, `renderStatus: 'error'` |
| Component takes >10s to render | Timeout, marked as error |
| 20 components rendered | Browser reused, total time < 2 minutes |
| Viewport set to 1440x900 | Screenshot dimensions match |

### Notes

- Use a single `browser` instance with multiple `page` instances (or reuse one page, navigating between components)
- Playwright's `page.screenshot({ clip: ... })` or element screenshot to isolate the component from the page chrome
- Headless mode is default. No need for headed mode in v1.0.

---

## E5-S4: Pixel Diff (pixelmatch)

### Description

Compare Playwright screenshot against Figma baseline image using pixelmatch. Produce a diff image and a count of differing pixels.

### Files to Create

```
src/render/
  pixel-diff.ts      # diffImages(screenshotPath, baselinePath, config) → DiffResult
```

### Acceptance Criteria

- [ ] Reads both PNG images using a PNG decoder (e.g., `pngjs`)
- [ ] If images have different dimensions: resizes screenshot to match baseline (or vice versa) with warning logged. Does NOT fail — mismatched dimensions are common when viewport config doesn't exactly match Figma frame size.
- [ ] Runs `pixelmatch(img1, img2, diffOutput, width, height, { threshold: tolerance/255 })`
  - `tolerance` from `render.tolerance` config (default 4)
- [ ] Returns `DiffResult`:
  ```typescript
  interface DiffResult {
    totalPixels: number        // width × height
    differentPixels: number    // pixelmatch return value
    matchPercentage: number    // round(((total - different) / total) * 100, 1)
    diffImagePath: string      // path to diff PNG
  }
  ```
- [ ] Saves diff image to `.pixelproof/screenshots/{ComponentName}.diff.png` — red pixels show differences
- [ ] Diff image uses pixelmatch's default diff color (red/yellow on transparent)

### Test Cases

| Scenario | Expected Output |
|---|---|
| Identical images (0 diff pixels) | `{ differentPixels: 0, matchPercentage: 100.0 }` |
| 10% pixels different | `matchPercentage: 90.0` |
| Images with different dimensions | Warning logged, resized, diff computed |
| Tolerance = 4 (default) | Anti-aliasing differences within 4px tolerance ignored |
| Tolerance = 0 (strict) | Every pixel difference counted |

### Notes

- pixelmatch works on raw pixel buffers — read PNGs into `Uint8Array` via `pngjs` before calling
- The threshold parameter in pixelmatch is 0-1 (normalized), NOT pixels. `tolerance` config is in pixel brightness units (0-255). Convert: `threshold = tolerance / 255`.
- Diff image is for dashboard display (E6-S6) — it overlays on the side-by-side viewer

---

## E5-S5: Render Fidelity Scoring

### Description

Calculate Render Fidelity percentage per component and aggregate. Write scores to the Score Store.

### Files to Create

```
src/scoring/
  render-fidelity.ts  # calculateRenderFidelity(diffResult) → number
```

### Acceptance Criteria

- [ ] Formula: `RenderFidelity = round(((P - D) / P) * 100, 1)` where P = `totalPixels`, D = `differentPixels`
- [ ] Score written to Score Store via `setRenderFidelity(file, score, 'rendered')`
- [ ] Skipped components (no nodeId mapping or render error): `setRenderFidelity(file, null, 'skipped')`
- [ ] Aggregate calculation: `sum(RenderFidelity for rendered) / count(rendered)` — skipped/error components EXCLUDED
- [ ] If 0 components rendered: aggregate = null (not 0)
- [ ] Score is a number with 1 decimal place: `91.2`, `100.0`, `87.5`

### Test Cases

| totalPixels | differentPixels | Expected Score |
|---|---|---|
| 1000000 | 0 | 100.0 |
| 1000000 | 100000 | 90.0 |
| 1000000 | 1000000 | 0.0 |
| 1000000 | 50000 | 95.0 |

| Aggregate Scenario | Expected |
|---|---|
| 3 rendered (90, 80, 100), 2 skipped | Aggregate = 90.0 |
| 0 rendered, 5 skipped | Aggregate = null |
| 1 rendered (75.5), 0 skipped | Aggregate = 75.5 |

---

## E5-S6: Render Pipeline Integration

### Description

Wire the full render fidelity pipeline into `npx pixelproof start`. On startup and on file change, run the screenshot → diff → score pipeline for all mapped components.

### Files to Modify

```
src/cli/index.ts             # Wire render pipeline into start command
src/render/
  pipeline.ts                # renderPipeline(config, scoreStore) — orchestrates full flow
```

### Acceptance Criteria

- [ ] **On startup** (after AST scan completes):
  1. Fetch/verify Figma baseline images for all `nodeIds`-mapped components
  2. Launch Playwright browser
  3. For each mapped component: screenshot → diff → score
  4. Write all render fidelity scores to Score Store
  5. Print summary: `"Render Fidelity: {X}% ({N} of {M} components rendered; {S} skipped)"`
- [ ] **On file change** (from watcher):
  1. If changed file is a component with `nodeIds` mapping: re-screenshot → re-diff → update score
  2. If changed file is NOT mapped: skip render pipeline (AST re-scan still runs)
  3. Print: `"Rescanned + re-rendered {Component}. Render Fidelity: {X}%"`
- [ ] **render.enabled = false**: skip entire render pipeline. Only AST scoring runs.
- [ ] **Chromium not installed**: skip render pipeline with warning (same as E5-S1)
- [ ] Render pipeline runs AFTER AST scan (token compliance first, render fidelity second — token score updates are faster)
- [ ] Total render time for 20 components: < 2 minutes

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| 5 components, 3 mapped in nodeIds | 3 rendered + scored, 2 skipped |
| `render.enabled: false` in config | No Playwright, no screenshots, no render scores |
| Chromium not installed | Warning printed, AST-only mode |
| Save `Button.tsx` (mapped in nodeIds) | Re-screenshot + re-diff + updated score |
| Save `utils.ts` (no component) | AST rescan only, no render |
| 20 mapped components | Full pipeline completes in < 2 minutes |

---

## E5 Dependency Graph

```
E5-S1 (Playwright setup)
  ↓
  ├──→ E5-S2 (Figma reference images)  [can parallel with S3 after S1]
  │
  └──→ E5-S3 (Screenshot capture)
           ↓
       E5-S4 (Pixel diff)
           ↓
       E5-S5 (Render Fidelity scoring)
           ↓
       E5-S6 (Pipeline integration)
```

**E5 is complete when:** `npx pixelproof start` captures Playwright screenshots of rendered components, compares against Figma baselines, calculates Render Fidelity scores, and updates scores on file change. Both Token Compliance (E3) and Render Fidelity (E5) scores are now in the Score Store.
