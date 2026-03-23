# Epic 6: Dashboard UI + Live Updates

**Goal:** After E6, `localhost:3001` serves a fully interactive dashboard showing Token Compliance and Render Fidelity scores, per-component drill-down, violation details with fix instructions, side-by-side render diffs, and a token reference panel. All data updates live via WebSocket — no page reloads.

**Depends on:** E4 (harness server serves the dashboard + API endpoints from E4-S7), E3 (Token Compliance data in Score Store), E5 (Render Fidelity data in Score Store)
**Unlocks:** Nothing — this is the final epic. After E6, PixelProof v1.0 is feature-complete.

> **Dashboard Layout Note:** No wireframes or mockups are provided. Dashboard is a developer tool — layout decisions are made by the dev agent using the component descriptions and acceptance criteria in each story. The visual treatment should follow developer tool conventions: dark theme, monospace fonts for code, minimal chrome, data-dense layouts. No external design approval is needed.
>
> **Scope Note:** Design System Migration Audit (UC-05) and Deprecated Token Detection are P2 features deferred to v1.1 per PRD Section 12. They are intentionally excluded from these epics.

---

## E6-S1: Dashboard React App Scaffold

### Description

Create the React + Vite dashboard application that is served as static assets from the harness Vite server at `localhost:3001`.

### Files to Create

```
src/dashboard/
  src/
    main.tsx           # React entry point
    App.tsx            # Root component with routing
    index.css          # Base styles (minimal reset, dark theme)
  vite.config.ts       # Dashboard Vite build config (for pre-building assets)
```

### Acceptance Criteria

- [ ] Dashboard is a React SPA served from the root path `/` on `:3001`
- [ ] Harness server (E4-S1) serves pre-built dashboard assets as static files (from `dashboard-dist/`)
- [ ] OR: dashboard runs as part of the same Vite dev server (shared server — single port)
- [ ] Route structure:
  - `/` — Overview (aggregate scores, component list)
  - `/component/:name` — Component detail view
  - `/tokens` — Token reference panel
- [ ] Uses client-side routing (hash router or Vite history fallback) — no server routes needed
- [ ] Dashboard shell renders: header with "PixelProof" branding, navigation sidebar/tabs, main content area
- [ ] Dark theme by default (developer tool convention)
- [ ] Responsive down to 1024px width (no mobile — this is a dev tool)
- [ ] No external UI library dependency (plain CSS / CSS Modules for styling — keep bundle small)

### Test Cases

| URL | Expected Behavior |
|---|---|
| `localhost:3001/` | Shows Overview page with header + nav |
| `localhost:3001/#/component/Button` | Shows Component detail page |
| `localhost:3001/#/tokens` | Shows Token reference page |
| Browser refresh on any route | App loads correctly (hash router) |

### Notes

- The dashboard is pre-built during `npm run build` of the PixelProof package and shipped as static assets in `dashboard-dist/`. In development, it runs alongside the harness via Vite.
- Keep dependencies minimal: React, React Router (hash mode). No state management library — Score Store data comes via WebSocket.

---

## E6-S2: WebSocket Server + Client

### Description

Implement the WebSocket server that pushes Score Store updates to the dashboard in real time. The dashboard client connects and receives score updates without polling.

### Files to Create

```
src/ipc/
  ws-server.ts       # WebSocket server — broadcasts Score Store events
src/dashboard/src/
  hooks/
    useScoreUpdates.ts  # React hook — connects to WS, returns live score data
```

### Acceptance Criteria

- [ ] WebSocket server starts on the same port as the harness (`:3001`), path `/ws`
- [ ] On client connect: sends full current state from Score Store (initial payload)
- [ ] Subscribes to Score Store `subscribe()` — on every mutation, broadcasts to all connected clients:
  ```json
  {
    "type": "score-update",
    "data": {
      "component": "src/components/Button.tsx",
      "tokenCompliance": 72.0,
      "renderFidelity": 91.2,
      "renderStatus": "rendered",
      "violations": [...]
    }
  }
  ```
- [ ] Also broadcasts aggregate updates:
  ```json
  {
    "type": "aggregate-update",
    "data": {
      "tokenCompliance": 85.2,
      "renderFidelity": 88.7,
      "totalComponents": 42,
      "renderedComponents": 35,
      "skippedComponents": 7,
      "totalViolations": 17
    }
  }
  ```
- [ ] Dashboard `useScoreUpdates()` hook:
  - Connects to `ws://localhost:{port}/ws`
  - Returns `{ components, aggregate, connected }` state
  - Auto-reconnects on disconnect (1s delay)
  - Updates React state on each message → triggers re-render
- [ ] **Client → Server messages:** WebSocket also handles inbound messages from the dashboard:
  ```json
  {
    "type": "render-request",
    "data": {
      "component": "src/components/Button.tsx",
      "export": "Button"
    }
  }
  ```
  - On `render-request`: triggers Playwright screenshot → diff → score update pipeline for the specified component
  - Responds with a `score-update` message when the pipeline completes
  - If Playwright/Chromium is not installed or `render.enabled: false`: responds with `{ type: "render-error", data: { message: "Render not available" } }`
- [ ] Multiple dashboard tabs can connect simultaneously
- [ ] WebSocket server uses `ws` npm package (lightweight)

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| Dashboard opens | Receives full initial state via WS |
| Developer saves file → AST rescan → Score Store updated | Dashboard receives `score-update` within 500ms |
| Developer saves file → Playwright re-renders | Dashboard receives render update within 5s |
| Dashboard tab closed and reopened | Reconnects, receives full state |
| Two dashboard tabs open | Both receive updates |
| Harness server stopped | Dashboard shows "Disconnected" state |

### Notes

- Use `ws` package, NOT `socket.io` (too heavy for this use case)
- WebSocket messages are JSON-serialized
- The initial state payload on connect includes ALL components — not just ones that have changed

---

## E6-S3: Overview Panel

### Description

The main landing page showing aggregate scores, sync status, and a high-level summary.

### Files to Create

```
src/dashboard/src/
  components/
    ScoreGauge.tsx       # Circular or arc gauge showing a percentage score
    OverviewPanel.tsx    # Main overview layout
    SyncStatus.tsx       # Token sync timestamp + source indicator
```

### Acceptance Criteria

- [ ] **Aggregate Token Compliance gauge:** large circular/arc visualization showing percentage (e.g., 85.2%)
  - Color: green (>80%), yellow (50-80%), red (<50%)
- [ ] **Aggregate Render Fidelity gauge:** same style, separate gauge
  - Shows "N/A" if no components rendered, or if `render.enabled: false`
- [ ] **Total violations count:** prominent number with label
- [ ] **Component summary:** "{N} components scanned, {R} rendered, {S} skipped"
- [ ] **Last sync status:** "Tokens synced {time} ago from {source}" where source is "Figma MCP" / "Figma REST API" / "Local files"
- [ ] All values update live via WebSocket (no refresh needed)
- [ ] Gauges animate on value change (CSS transition — keep it subtle)

### Test Cases

| Score Store State | Expected Display |
|---|---|
| TC: 85.2%, RF: 91.0%, 42 components, 17 violations | Green TC gauge (85.2%), green RF gauge (91.0%), "17 violations", "42 components" |
| TC: 45.0%, RF: null, 10 components, 30 violations | Red TC gauge (45.0%), RF shows "N/A", "30 violations" |
| No components scanned yet | Gauges show "—", "0 components scanned" |
| Score updates via WS | Gauges animate to new values |

---

## E6-S4: Component List

### Description

A sortable, filterable list of all discovered components with their individual scores.

### Files to Create

```
src/dashboard/src/
  components/
    ComponentList.tsx    # List of component cards
    ComponentCard.tsx    # Individual component summary card
```

### Acceptance Criteria

- [ ] Lists all discovered components as cards/rows
- [ ] Each card shows:
  - Component name (export name)
  - File path (relative)
  - Token Compliance % (color-coded: green/yellow/red)
  - Render Fidelity % (color-coded, or "Skipped" / "Error" badge)
  - Violation count badge
- [ ] Clicking a card navigates to `/component/:name` (detail view — E6-S5)
- [ ] **Sort by:** name (A-Z), Token Compliance (asc/desc), Render Fidelity (asc/desc), violation count
- [ ] **Filter by:** status ("All", "Has Violations", "Render Errors", "Passing")
- [ ] **Search:** text filter by component name or file path
- [ ] "Render skipped" components show a distinct visual state (muted card, "Skipped" badge)
- [ ] "Render error" components show error badge with error message preview
- [ ] List updates live — new components appear, scores animate on change

### Test Cases

| Scenario | Expected Display |
|---|---|
| 42 components, mixed scores | 42 cards with color-coded scores |
| Sort by Token Compliance (ascending) | Lowest TC% first |
| Filter "Has Violations" | Only components with violations > 0 shown |
| Search "Button" | Only components with "Button" in name or path shown |
| Component render skipped | Card shows "Skipped — props required" badge |
| New file added (watcher detects) | Card appears in list automatically |

---

## E6-S5: Component Detail View

### Description

Drill-down view for a single component showing violations with fix instructions and inline code highlighting.

### Files to Create

```
src/dashboard/src/
  pages/
    ComponentDetail.tsx    # Full detail page
  components/
    ViolationList.tsx      # List of violations with fix instructions
    CodePreview.tsx        # Inline code view with highlighted violation lines
```

### Acceptance Criteria

- [ ] **Header:** Component name, file path (clickable — copies to clipboard), Token Compliance %, Render Fidelity %
- [ ] **Violation list:** Each violation shows:
  - Line number + column
  - Property name (`color`, `fontSize`, etc.)
  - Found value (`#6366f1`)
  - Expected token: `var(--color-primary)` with the Figma token path `colors/primary`
  - Confidence: "Exact match" or "Approximate"
  - Fix suggestion: `Replace with var(--color-primary)` or `Replace with tokens.colorPrimary`
- [ ] **Code preview:** Shows the source file content with violation lines highlighted
  - Syntax highlighted (basic keyword/string/comment coloring — no external library like Prism needed, but acceptable if small)
  - Violation lines have a red/orange background
  - Line numbers in gutter
  - Scrolls to first violation on load
- [ ] **Scores section:** Token Compliance gauge + Render Fidelity gauge for this component only
- [ ] Updates live: developer saves file → violations + code preview update automatically
- [ ] Back button returns to component list

### Test Cases

| Scenario | Expected Display |
|---|---|
| Component with 3 violations | 3 items in violation list, 3 highlighted lines in code preview |
| Component with 0 violations | "No violations found" message, clean code preview |
| Violation on line 42 | Code preview scrolls to line 42, line 42 highlighted |
| Developer fixes a violation, saves | Violation disappears from list, code preview updates, score increases |
| File path clicked | Copies `src/components/Button.tsx:42` to clipboard |

### Notes

- Code preview reads the source file content via the `GET /api/source?file=...` endpoint on the harness server (E4-S7) — not via WebSocket (file content is too large for WS)
- **Depends on E4-S7** for the `/api/source` endpoint

---

## E6-S6: Render Fidelity Diff Viewer

### Description

Side-by-side visual comparison of the Playwright screenshot vs Figma baseline, with a pixel diff overlay toggle.

### Files to Create

```
src/dashboard/src/
  components/
    DiffViewer.tsx       # Side-by-side image comparison
    DiffOverlay.tsx      # Pixel diff overlay toggle
```

### Acceptance Criteria

- [ ] Shows two images side by side:
  - **Left:** Playwright screenshot (actual render) — labeled "Rendered"
  - **Right:** Figma baseline image — labeled "Figma Baseline"
- [ ] **Diff overlay toggle:** button to overlay the pixelmatch diff image on top of the screenshot (semi-transparent red highlights)
- [ ] **Slider mode (optional):** drag slider to compare left/right (like GitHub image diff)
- [ ] Render Fidelity score displayed prominently: `"Render Fidelity: 91.2%"`
- [ ] Images served from harness server: `GET /api/screenshot/:component` and `GET /api/baseline/:component` and `GET /api/diff/:component`
- [ ] If component has no baseline (not in `nodeIds`): shows "No Figma baseline mapped. Add this component to figma.nodeIds in .pixelproofrc"
- [ ] If component render was skipped/error: shows "Render skipped — props required" message instead of images
- [ ] Images update after re-render (file change triggers new screenshot → dashboard reloads images)

### Test Cases

| Scenario | Expected Display |
|---|---|
| Component with 91.2% fidelity | Side-by-side images, "91.2%" score, diff overlay available |
| Diff overlay toggled ON | Red highlights on differing pixels visible over screenshot |
| No Figma baseline for component | Message: add to nodeIds config |
| Render skipped | "Render skipped" message, no images |
| File saved, re-rendered | Images reload with new screenshots |

### Notes

- Images are served via the harness server endpoints created in E4-S7: `/api/screenshot/:component`, `/api/baseline/:component`, `/api/diff/:component`
- **Depends on E4-S7** for the image serving endpoints

---

## E6-S7: Token Reference Panel

### Description

A searchable panel showing all tokens synced from the token cache, with alias chains and resolved values.

### Files to Create

```
src/dashboard/src/
  pages/
    TokenReference.tsx   # Token reference panel page
  components/
    TokenTable.tsx       # Sortable/filterable token table
    TokenDetail.tsx      # Expanded token detail (alias chain)
```

### Acceptance Criteria

- [ ] Lists all tokens from `token-cache.json` in a table format
- [ ] Columns: Token Path, CSS Variable, Resolved Value, Type, Alias Chain
- [ ] **Color tokens:** show a color swatch next to the resolved hex value
- [ ] **Search/filter:** text search across token path, CSS variable, and resolved value
- [ ] **Filter by type:** "All", "Color", "Spacing", "Typography", "Border Radius", "Shadow"
- [ ] Clicking a token row expands to show full alias chain: `colors/brand/primary → colors/blue/600 → #0050C0`
- [ ] **Token count:** "Showing {N} of {M} tokens" (with filter)
- [ ] Token data loaded via `GET /api/tokens` endpoint (E4-S7) which returns the full token cache JSON
- [ ] Shows token source: "Figma MCP" / "Figma REST API" / "Local files"
- [ ] Shows last sync time

### Test Cases

| Scenario | Expected Display |
|---|---|
| 150 tokens synced | Table with 150 rows, scrollable |
| Search "primary" | Filters to tokens containing "primary" in path or CSS var |
| Filter "Color" type | Only color tokens shown |
| Click on `colors/brand/primary` | Expands to show: `colors/brand/primary → colors/blue/600 → #0050C0` |
| Color token `#0050C0` | Blue color swatch shown next to value |
| Spacing token `16px` | No swatch, value shown as text |

---

## E6-S8: Component Render Interaction

### Description

Allow the dashboard to trigger on-demand renders and re-renders of components via the iframe harness.

### Files to Create / Modify

```
src/dashboard/src/
  components/
    RenderButton.tsx     # "Render" / "Re-render" button on component cards
    HarnessIframe.tsx    # Iframe embedding the harness renderer
```

### Acceptance Criteria

- [ ] Component detail page embeds an iframe pointing to the harness URL: `localhost:{port}/harness?component={file}&export={name}`
- [ ] "Re-render" button on component detail page: triggers Playwright to re-screenshot the component and re-diff
- [ ] Button sends a WebSocket message: `{ type: 'render-request', component: 'src/components/Button.tsx', export: 'Button' }`
- [ ] Harness server receives the message, triggers screenshot → diff → score update pipeline
- [ ] Dashboard shows a spinner on the Render Fidelity gauge while Playwright is running
- [ ] On completion: gauge updates, diff viewer reloads images
- [ ] Iframe shows the live rendered component — developer can visually inspect it
- [ ] If component has mockProps configured: iframe renders with those props

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| Open component detail for Button | Iframe shows rendered `<Button />` |
| Click "Re-render" | Spinner on gauge, new screenshot captured, score updates |
| Component with mockProps | Iframe renders with mock props |
| Component with render error | Iframe shows ErrorBoundary fallback |
| Re-render completes | Diff viewer shows updated screenshots |

---

## E6 Dependency Graph

```
E4-S7 (API endpoints)  ────────────────────────────────────────┐
                                                                │
E6-S1 (React scaffold)  ──┐                                    │
                            ├──→ E6-S3 (Overview panel)         │
E6-S2 (WebSocket)        ──┤                                    │
                            ├──→ E6-S4 (Component list) ──→ E6-S5 (Component detail) [needs E4-S7]
                            │                                       │
                            ├──→ E6-S7 (Token reference) [needs E4-S7]
                            │                                       │
                            │                                  ├──→ E6-S6 (Diff viewer) [needs E4-S7]
                            │                                       │
                            └──→ E6-S8 (Render interaction) ───────┘
```

Note: S1 and S2 are foundational. S3, S4, S7 can start in parallel after S1+S2. S5 depends on S4 (navigation from list) and E4-S7 (source API). S6 depends on S5 and E4-S7 (image APIs). S7 depends on E4-S7 (tokens API). S8 depends on S5 and E6-S2 (bidirectional WebSocket for render-request).

**E6 is complete when:** `localhost:3001` serves a fully interactive dashboard with live-updating scores, per-component drill-down with violation details and fix instructions, side-by-side render diff viewer, token reference panel, and on-demand re-render capability. **PixelProof v1.0 is feature-complete.**
