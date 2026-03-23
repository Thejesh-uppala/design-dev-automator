---
project: PixelProof
version: v1.0 (local-only)
generated: 2026-03-20
source: _bmad-output/planning-artifacts/prd.md (v1.2)
---

# PixelProof — Project Context

> Load this file instead of re-reading the full PRD. It contains the essential rules, architecture decisions, and scope boundaries every agent needs.

---

## What PixelProof Is

**PixelProof** is a developer-first `devDependency` (`npm install --save-dev pixelproof`) that validates the fidelity of React component implementations against their Figma design specifications.

**Core tagline:** "Catch token violations before code review. Figma-connected. No Storybook required."

It delivers two simultaneous signals per component:

| Score | Engine | What it measures |
|---|---|---|
| **Token Compliance %** | Static AST analysis | % of style properties using correct design tokens vs hardcoded values |
| **Render Fidelity %** | Playwright + computed CSS | % of visual properties matching Figma spec at runtime |

Both scores are separate by design — a component can have 100% token compliance but 70% render fidelity (CSS cascade issue), or vice versa.

---

## v1.0 Scope — Local Only

**PixelProof v1.0 is a local developer tool only.**

A developer runs `npx pixelproof`, which:
1. Scans `src/` via AST for token violations
2. Serves a local dashboard at `localhost:3001`
3. (Paid) Renders components in an iframe harness and captures Playwright screenshots for fidelity scoring

**The single question v1.0 answers:** *"Does my component use the right design tokens?"* — in under 15 minutes from install.

---

## Locked Architecture Decisions

These decisions are final for v1.0. Do not revisit or propose alternatives.

### Authentication
- **Figma: PAT only.** No OAuth in v1.0. User provides `FIGMA_PAT` via env var or `.pixelproofrc`. OAuth deferred to v1.1 (requires Figma app registration with indeterminate review timeline).

### Component Rendering
- **Zero-prop render by default.** Components that fail zero-prop render are wrapped in a React error boundary and marked "render skipped — props required" in the dashboard.
- Skipped components: Token Compliance (AST) still runs. They are excluded from aggregate Render Fidelity % — they do not penalise the score.
- Optional per-component `mockProps` config in `.pixelproofrc` allows teams to provide static props objects for full fidelity scoring.

### Theme Handling
- **Single theme per run.** Default: `light`. Configurable via `render.theme` in `.pixelproofrc` (`"light"` / `"dark"` / `"system"`).
- Teams needing both light/dark coverage run two separate PixelProof invocations.

### Tailwind CSS
- **Not in v1.0.** Planned v1.2. Tailwind's utility-class system is architecturally distinct from CSS custom properties — requires a dedicated mapping layer.

### CI / Automation
- **No CI mode in v1.0.** `npx pixelproof --ci`, GitHub Actions integration, PR comment posting — all deferred to v1.1.

---

## Tech Stack

| Component | Technology |
|---|---|
| CLI runner | Node.js ≥ 18 (LTS) |
| AST parser | `@babel/parser` + `@babel/traverse` (full TSX support) |
| CSS/SCSS parser | `postcss` + `postcss-scss` |
| Token cache | JSON file in `.pixelproof/token-cache.json` |
| Figma API client | Figma REST API v1 (PAT auth only) |
| Dashboard UI | React + Vite (bundled into PixelProof) |
| Runtime harness | Vite plugin + iframe injection |
| Screenshot capture | Playwright (Chromium) — downloaded on first use, not on npm install |
| Pixel diff | `pixelmatch` |

**Platform:** Windows, macOS, Linux. Node ≥ 18.0.0.

---

## Framework and CSS-in-JS Support (v1.0)

**React frameworks with full support:** React (CRA, Vite), Next.js App Router (client components only), Next.js Pages Router.

**CSS-in-JS with full support:** Inline styles (JSX style prop), CSS Modules, styled-components (template literal parsing), Emotion, vanilla-extract (`.css.ts`).

**Angular:** Out of scope permanently. **Vue:** v2.0 planned. **Remix render harness:** v1.1.

---

## Token Format Support

| Format | Level |
|---|---|
| W3C DTCG (`application/design-tokens+json`) | **Primary** — full support |
| Style Dictionary CSS custom properties | Full support |
| Style Dictionary JS/TS export | Full support |
| Token Studio Figma plugin export | Full support (via format converter) |
| SCSS variables | Read-only (detect violations; cannot write) |
| Raw hardcoded JS constant files | Detection only (flagged as violation) |

Token resolution: PixelProof resolves Figma alias chains fully and caches both the alias name and resolved value. AST scanner matches against both.

---

## Configuration — `.pixelproofrc`

PixelProof is configured via `.pixelproofrc` (JSON or YAML) at the project root. Key fields:

```yaml
figma:
  fileId: "abc123..."
  personalAccessToken: "${FIGMA_PAT}"   # env var reference — never hardcode
  syncTTL: 86400                        # 24 hours default

scan:
  include: ["src/components/**", "src/features/**"]
  exclude: ["**/*.test.tsx", "**/*.stories.tsx", "**/node_modules/**"]
  fileTypes: ["tsx", "ts", "jsx", "js", "css", "scss"]

tokens:
  format: "dtcg"                        # "dtcg" | "style-dictionary" | "token-studio"
  fallbackDir: "tokens/"                # local fallback if Figma unreachable

dashboard:
  port: 3001

render:
  enabled: true
  viewport: { width: 1440, height: 900 }
  tolerance: 2                          # pixel tolerance (open question — may adjust)
  theme: "light"                        # single theme per run
  components:
    DataTable:
      mockProps: "./mocks/DataTable.mock.ts"   # exports default plain object
```

---

## Non-Functional Rules (Hard Requirements)

- **Zero Storybook dependency.** PixelProof must not require, import, or depend on Storybook in any form.
- **Zero app instrumentation required.** No changes to application source code. Only add `.pixelproofrc` and run `npx pixelproof`.
- **Install size:** < 50MB without Chromium. Chromium downloaded on first use (`pixelproof install`), not on npm install.
- **Figma PAT never logged, echoed, or included in any output.**
- **No telemetry without explicit opt-in.** Opt-in collects only: npm version, Node version, framework detected, scan duration — never file contents.
- **Source code analyzed locally only.** No code transmitted to PixelProof servers. Paid tier transmits only aggregate scores and violation counts.

---

## Performance Targets

| Operation | Target |
|---|---|
| AST scan (100 components) | < 10 seconds |
| Figma token sync (first pull) | < 30 seconds |
| Figma token sync (cached) | < 1 second |
| Dashboard initial load | < 3 seconds |
| Per-component render + screenshot | < 5 seconds |
| Full render fidelity run (20 components) | < 2 minutes |

---

## Explicitly Out of Scope for v1.0

Do not design, implement, or plan for these items in v1.0 work:

| Item |
|---|
| CI Mode (`npx pixelproof --ci`) |
| GitHub Actions integration / PR comment posting |
| Team Dashboard (multi-project workspace, cross-project view) |
| Historical trend charts (compliance score over time) |
| Compliance score export (JSON/CSV) |
| Figma OAuth |
| Tailwind CSS token mapping |
| Vue, Angular, Svelte support |
| Design-to-code generation |
| Automated code fixes (auto-replace violations) |
| Mobile / React Native |
| Server-side rendering validation |
| WCAG / accessibility auditing |
| Design token authoring / editing in Figma |
| Multi-framework monorepos |
| Figma plugin (companion plugin — planned v1.1) |

---

## Open Architecture Questions

These are unresolved and should be flagged to the architect/product owner when relevant:

| # | Question |
|---|---|
| OQ-03 | Should Token Compliance score weight violations by token type (color > spacing)? |
| OQ-04 | Gitignore strategy for `.pixelproof/` — is the token cache sensitive? |
| OQ-05 | Should PixelProof auto-detect `.env` for `FIGMA_PAT`, or require explicit `.pixelproofrc`? |
| OQ-06 | Is 2px the right Render Fidelity tolerance default? May be too strict for anti-aliasing. |
| NQ-01 | Error UX for expired/revoked PAT — specific diagnostic vs generic API failure? |
| NQ-02 | Should `mockProps` support TS factory functions in addition to static objects? |
| NQ-03 | Visual treatment for "render skipped" components in dashboard? |

---

## Violation Output Format

AST violations are reported at file + line granularity:

```
[VIOLATION] src/components/Button/Button.tsx:42
  Found: color="#FF5733"
  Expected token: var(--color-primary-500)
  Figma token: colors/primary/500 → #FF5733
  Fix: Replace with `color={tokens.colorPrimary500}` or `color="var(--color-primary-500)"`
```

---

## Key Files and Directories

| Path | Purpose |
|---|---|
| `.pixelproofrc` | Project configuration (JSON or YAML) |
| `.pixelproof/token-cache.json` | Cached Figma token definitions (gitignored by default) |
| `tokens/` | Local token fallback directory (Style Dictionary output or W3C DTCG JSON) |
| `localhost:3001` | Dashboard served during `npx pixelproof` |

---

*Generated from PRD v1.2 — 2026-03-20. If the PRD is updated, regenerate this file.*
