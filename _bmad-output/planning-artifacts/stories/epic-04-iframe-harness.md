# Epic 4: Iframe Harness + Component Isolation

**Goal:** After E4, PixelProof spawns a Vite dev server on `:3001` that can render any discovered React component in isolation inside an iframe — with auto-detected context providers, error boundaries, and optional mock props. No dashboard UI yet — just the rendering infrastructure.

**Depends on:** E1 (config, component discovery)
**Unlocks:** E5 (Playwright screenshots of rendered components), E6 (dashboard embeds iframe)

---

## E4-S1: Harness Vite Dev Server

### Description

Spawn a Vite dev server on the configured port (default `:3001`) that serves as the rendering harness. Merge the user project's `vite.config.ts` (if present) to inherit aliases, plugins, and environment handling.

### Files to Create

```
src/render/
  harness-server.ts  # startHarnessServer(config) → { server, close() }
```

### Acceptance Criteria

- [ ] Starts a Vite dev server on `config.dashboard.port` (default 3001)
- [ ] If user project has a `vite.config.ts` or `vite.config.js` at root: reads it and merges as base config (aliases, plugins, resolve config are inherited)
- [ ] If no user Vite config: uses a minimal Vite config (React plugin, standard resolve)
- [ ] Server listens on `localhost` only (not exposed to network)
- [ ] `localhost:3001` responds with HTTP 200 (placeholder page for now — dashboard in E6)
- [ ] Server starts within 5 seconds
- [ ] `close()` method shuts down Vite cleanly (no lingering processes or file handles)
- [ ] Console output: `"PixelProof harness running at http://localhost:{port}"`

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| User project has `vite.config.ts` with path aliases | Aliases available in harness (e.g., `@/components` resolves) |
| User project has no Vite config (CRA or Next.js) | Harness starts with default React Vite config |
| Port 3001 already in use | Throws descriptive error: "Port 3001 is in use. Configure a different port in .pixelproofrc" |
| `close()` called | Server stops, port freed |

### Notes

- Use Vite's `createServer()` API (not CLI) for programmatic control
- Add `@vitejs/plugin-react` for JSX/TSX support
- The harness server is started by `npx pixelproof start` AFTER the initial AST scan completes
- For Next.js projects: the harness uses Vite regardless — it does NOT use Next.js dev server. Components are imported directly from `src/`.

---

## E4-S2: Virtual Module + Component Renderer

### Description

Create a Vite virtual module (`virtual:pixelproof-harness`) that renders a target component based on URL query parameters. No physical files written to the user's `src/` directory.

### Files to Create

```
src/render/
  vite-plugin.ts     # pixelproofPlugin() — Vite plugin with virtual module
  harness-entry.tsx   # Template for the virtual module (React component)
```

### Acceptance Criteria

- [ ] Vite plugin registers virtual module `virtual:pixelproof-harness`
- [ ] Harness URL pattern: `localhost:3001/harness?component=src/components/Button.tsx&export=Button`
- [ ] Virtual module reads `component` and `export` query params from the URL
- [ ] Dynamic imports the target module: `await import(/* @vite-ignore */ componentPath)`
- [ ] Renders the named export (or `default` if `export` param is `default`)
- [ ] If component path is invalid: shows error message in the iframe: `"Component not found: {path}"`
- [ ] If export name doesn't exist in module: shows error: `"Export 'Foo' not found in {path}. Available exports: Button, ButtonGroup"`
- [ ] Component renders into a `<div id="pixelproof-root">` with no margins/padding (clean measurement surface)
- [ ] Zero props by default — component rendered as `<Component />`

### Test Cases

| URL | Expected Behavior |
|---|---|
| `/harness?component=src/components/Button.tsx&export=Button` | Renders `<Button />` |
| `/harness?component=src/components/Button.tsx&export=default` | Renders default export |
| `/harness?component=nonexistent.tsx&export=Foo` | Shows "Component not found" error |
| `/harness?component=src/components/Button.tsx&export=NonExistent` | Shows "Export not found" with available exports listed |
| `/harness` (no params) | Shows "No component specified" message |

### Notes

- Use Vite's `resolveId` + `load` hooks for the virtual module
- The virtual module is generated as a string at request time — it's a code template with the component path injected
- `@vite-ignore` comment on dynamic import suppresses Vite's analysis warning

---

## E4-S3: Error Boundary + Render Failure Handling

### Description

Wrap each component render in a React ErrorBoundary. Components that throw on zero-prop render are caught gracefully, marked as "render skipped," and excluded from Render Fidelity scoring.

### Files to Create

```
src/render/
  ErrorBoundary.tsx  # React ErrorBoundary component
```

### Acceptance Criteria

- [ ] ErrorBoundary wraps the rendered component in the virtual harness entry
- [ ] On throw: catches error, renders fallback UI showing: component name, error message, stack trace (truncated)
- [ ] Posts error to the parent window (dashboard) via `window.parent.postMessage({ type: 'render-error', component, error })` — for E6 to consume
- [ ] Component marked `renderStatus: 'error'` in Score Store
- [ ] Error components are excluded from aggregate Render Fidelity % (they do NOT contribute 0%)
- [ ] Token Compliance (AST) results are unaffected by render failure — AST scan runs on source code, not runtime
- [ ] ErrorBoundary has a `resetErrorBoundary` method — re-renders on HMR update (developer fixes the component → it should re-try render)

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| Component requires `items` prop (throws on undefined) | ErrorBoundary catches, shows fallback with error message |
| Component renders successfully with zero props | No ErrorBoundary fallback shown |
| Component throws, developer fixes and saves | HMR triggers re-render, ErrorBoundary resets, component renders |
| 5 components: 3 render, 2 throw | Aggregate Render Fidelity based on 3 rendered only |

---

## E4-S4: Provider Detection

### Description

AST scan the project's entry files (`src/main.tsx`, `src/index.tsx`, `src/App.tsx`) to detect React context providers that components may depend on (ThemeProvider, Redux Provider, etc.).

### Files to Create

```
src/render/
  provider-detector.ts  # detectProviders(config) → ProviderConfig[]
```

### Acceptance Criteria

- [ ] Scans these files (first found wins): `src/main.tsx`, `src/main.jsx`, `src/index.tsx`, `src/index.jsx`, `src/App.tsx`, `src/App.jsx`
- [ ] Detects JSXElements matching known provider patterns:
  - `ThemeProvider` (MUI, styled-components, Emotion)
  - `Provider` (react-redux)
  - `QueryClientProvider` (TanStack Query)
  - `RouterProvider` / `BrowserRouter` (React Router)
  - `AuthProvider` (generic auth)
  - `I18nextProvider` (i18next)
  - `ChakraProvider` (Chakra UI)
  - `MantineProvider` (Mantine)
- [ ] For each detected provider, extracts:
  - `component`: the JSX element name
  - `importPath`: the import source (e.g., `'@mui/material'`)
  - `staticProps`: props that are static imports (e.g., `theme={theme}` where `theme` is imported from `./theme`)
  - `hasDynamicProps`: boolean — true if any prop is a non-importable expression
- [ ] Returns `ProviderConfig[]` ordered by nesting depth (outermost provider first)
- [ ] If a provider has dynamic props → `hasDynamicProps: true`. Dashboard will warn.

### Test Cases

| Input (`main.tsx`) | Expected Output |
|---|---|
| `<ThemeProvider theme={theme}><App /></ThemeProvider>` with `import { theme } from './theme'` | `[{ component: 'ThemeProvider', importPath: '@mui/material', staticProps: { theme: './theme' }, hasDynamicProps: false }]` |
| `<Provider store={store}><App /></Provider>` | Detected: react-redux Provider |
| `<ThemeProvider theme={getTheme()}><App /></ThemeProvider>` | `hasDynamicProps: true` (function call, not static) |
| No providers found | Empty array `[]` |
| `<ChakraProvider><MantineProvider><App /></MantineProvider></ChakraProvider>` | Two providers, Chakra first (outermost) |

### Notes

- Provider detection runs once at startup — results are cached for the session
- This is a best-effort detection. Not all provider patterns can be detected statically. The explicit override in `.pixelproofrc` (E4-S5) is the escape hatch.

---

## E4-S5: Provider Wrapping in Harness

### Description

Use detected providers (or explicit config override) to wrap components in the correct context when rendering in the harness.

### Files to Modify

```
src/render/
  vite-plugin.ts     # Update virtual module template to include provider wrapping
```

### Acceptance Criteria

- [ ] Auto-detected providers from E4-S4 are injected as wrapper components in the virtual harness entry
- [ ] Wrapping order matches detection order (outermost first)
- [ ] Static props from detection are imported and passed to providers
- [ ] If `.pixelproofrc` has `render.providers` configured: **replaces** auto-detection entirely
  ```yaml
  render:
    providers:
      - "./src/providers/ThemeProvider"   # default export assumed
      - "./src/store/ReduxProvider"
  ```
- [ ] Explicit provider paths are imported and wrapped in listed order
- [ ] Provider with `hasDynamicProps: true`: skipped from wrapping, warning logged: `"ThemeProvider detected but has dynamic props — add to render.providers in .pixelproofrc for full context"`
- [ ] Generated wrapping template example:
  ```tsx
  import { ThemeProvider } from '@mui/material'
  import { theme } from './src/theme'

  function Harness({ Component }) {
    return (
      <ThemeProvider theme={theme}>
        <Component />
      </ThemeProvider>
    )
  }
  ```

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| Auto-detected ThemeProvider with static `theme` prop | Component rendered inside `<ThemeProvider theme={theme}>` |
| Auto-detected Provider with dynamic store | Skipped, warning logged |
| `render.providers` set in config with 2 paths | Both providers wrap component, auto-detection skipped |
| No providers detected or configured | Component rendered bare: `<Component />` |

---

## E4-S6: mockProps Support

### Description

Allow per-component mock props via `.pixelproofrc` configuration. When mock props are provided, use them instead of zero-prop render.

### Files to Modify

```
src/render/
  vite-plugin.ts     # Update virtual module to inject mock props
```

### Acceptance Criteria

- [ ] Config format:
  ```yaml
  render:
    components:
      Button:
        mockProps:
          variant: "primary"
          size: "lg"
          children: "Click me"
      DataTable:
        mockProps:
          rows: []
          columns: ["Name", "Email"]
  ```
- [ ] Mock props are JSON-compatible plain objects defined inline in `.pixelproofrc`
- [ ] When `mockProps` is configured for a component, harness renders `<Component {...mockProps} />` instead of `<Component />`
- [ ] When `mockProps` is NOT configured, renders `<Component />` (zero-prop default)
- [ ] Component name matching: `export` name in URL must match the key in `render.components` (case-sensitive)
- [ ] Invalid mock props (not a plain object) → config validation error at startup

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| `mockProps` configured for Button with `{ variant: "primary" }` | Harness renders `<Button variant="primary" />` |
| No `mockProps` configured for Card | Harness renders `<Card />` |
| `mockProps` with nested object `{ style: { color: "red" } }` | Passed correctly as nested prop |
| `mockProps` with array `{ items: [1, 2, 3] }` | Passed correctly as array prop |

### Architecture Note

> **Conflict flagged:** The architecture ADR NQ-02 states "inline config only — no external mock file path in v1.0." The PRD and project-context.md show `mockProps: "./mocks/DataTable.mock.ts"` (external file path). This story follows the ADR decision: **inline objects only in v1.0.** External mock files deferred to v1.1.

---

## E4-S7: Dashboard API Endpoints

### Description

Add REST API endpoints to the harness Vite server that the dashboard (E6) will consume for source files, screenshots, baselines, diff images, and token data.

### Files to Modify

```
src/render/
  harness-server.ts  # Add API route handlers to the Vite server middleware
```

### Acceptance Criteria

- [ ] `GET /api/source?file=src/components/Button.tsx` — returns the source file content as plain text (`Content-Type: text/plain`)
  - File path is relative to project root
  - Returns 404 if file does not exist
  - Returns 400 if `file` query parameter is missing
  - Path traversal prevention: rejects paths containing `..` or absolute paths
- [ ] `GET /api/screenshot/:component` — serves the Playwright screenshot PNG from `.pixelproof/screenshots/{component}.png`
  - Returns 404 if screenshot does not exist (component not yet rendered)
  - `Content-Type: image/png`
- [ ] `GET /api/baseline/:component` — serves the Figma baseline PNG from `.pixelproof/baselines/{component}.png`
  - Returns 404 if baseline does not exist (no Figma nodeId mapping)
  - `Content-Type: image/png`
- [ ] `GET /api/diff/:component` — serves the pixelmatch diff PNG from `.pixelproof/screenshots/{component}.diff.png`
  - Returns 404 if diff does not exist
  - `Content-Type: image/png`
- [ ] `GET /api/tokens` — returns the full token cache as JSON from `.pixelproof/token-cache.json`
  - Returns `{ tokens: [], syncedAt: null, source: null }` if no cache exists (not an error)
  - `Content-Type: application/json`
- [ ] All endpoints are registered as Vite server middleware (before Vite's own middleware)
- [ ] All endpoints return appropriate CORS headers for `localhost` origin
- [ ] No authentication required (local dev server only)

### Test Cases

| Request | Expected Response |
|---|---|
| `GET /api/source?file=src/components/Button.tsx` (file exists) | 200, file content as text |
| `GET /api/source?file=src/components/Missing.tsx` | 404 |
| `GET /api/source?file=../../etc/passwd` | 400 (path traversal rejected) |
| `GET /api/source` (no file param) | 400 |
| `GET /api/screenshot/Button` (screenshot exists) | 200, PNG image |
| `GET /api/screenshot/Missing` | 404 |
| `GET /api/baseline/Button` (baseline exists) | 200, PNG image |
| `GET /api/baseline/Unmapped` | 404 |
| `GET /api/diff/Button` (diff exists) | 200, PNG image |
| `GET /api/tokens` (cache exists) | 200, JSON token cache |
| `GET /api/tokens` (no cache) | 200, empty structure |

### Notes

- These endpoints are consumed by E6 stories: E6-S5 (source), E6-S6 (screenshot/baseline/diff), E6-S7 (tokens)
- Path traversal prevention on `/api/source` is critical — this endpoint exposes file content from the project
- Image endpoints serve static files from `.pixelproof/` — use Vite's `sirv` or `send` for efficient static file serving
- All endpoints are added to the same Vite server from E4-S1 (no additional server or port)

---

## E4 Dependency Graph

```
E4-S1 (Vite dev server)
  ↓
E4-S2 (Virtual module + renderer)
  ↓
  ├──→ E4-S3 (Error boundary)       [can start after S2]
  ├──→ E4-S4 (Provider detection)   [independent of S2, but needs config from E1]
  │        ↓
  └──→ E4-S5 (Provider wrapping)    [depends on S2 + S4]
  ↓
E4-S6 (mockProps)                    [depends on S2]
E4-S7 (Dashboard API endpoints)     [depends on S1]
```

**E4 is complete when:** `localhost:3001/harness?component=X&export=Y` renders any React component in isolation with correct provider context, error boundaries for failures, optional mock props, and the harness server exposes REST API endpoints for source files, screenshots, baselines, diffs, and token data.
