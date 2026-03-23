---
stepsCompleted: [step-01-init, step-02-discovery, step-03-problem, step-04-goals, step-05-personas, step-06-features, step-07-requirements, step-08-technical, step-09-gtm, step-10-constraints, step-11-metrics, edit-oq-resolution-2026-03-20, edit-scope-local-only-2026-03-20]
inputDocuments:
  - _bmad-output/planning-artifacts/research/domain-ui-design-to-code-fidelity-validation-research-2026-03-20.md
workflowType: 'prd'
project: PixelProof
---

# Product Requirements Document — PixelProof

**Author:** ThejeshMulinja
**Date:** 2026-03-20
**Status:** Draft v1.2 — Scope Revised: Local-Only v1.0 | Ready for Architecture
**Document Type:** Product Requirements Document

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Personas](#4-user-personas)
5. [Use Cases & User Stories](#5-use-cases--user-stories)
6. [Product Features](#6-product-features)
7. [Functional Requirements](#7-functional-requirements)
8. [Technical Requirements](#8-technical-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Pricing & Packaging](#10-pricing--packaging)
11. [Go-to-Market](#11-go-to-market)
12. [Out of Scope](#12-out-of-scope)
13. [Risks & Dependencies](#13-risks--dependencies)
14. [Open Questions](#14-open-questions)

---

## 1. Executive Summary

**PixelProof** is a developer-first devDependency that validates the fidelity of React component implementations against their Figma design specifications. It does this through two simultaneous signals:

1. **Token Compliance Score** — Static AST analysis of React/TypeScript source files to detect hardcoded style values (hex colors, raw spacing units, raw font sizes) that should be design tokens from the connected Figma file.
2. **Render Fidelity Score** — Runtime screenshot comparison of locally rendered components against Figma spec values, using Playwright and CSS computed property extraction.

PixelProof installs as `npm install --save-dev pixelproof`. It launches a local dashboard on `:3001` using an iframe harness that reads from the project's existing `src/` tree — no Storybook, no story files, no separate component catalog required.

**The core promise:** "Catch token violations before code review. Figma-connected. No Storybook required."

**v1.0 scope — local-only:** PixelProof v1.0 is a local developer tool. It runs on the developer's machine, scans their project, and serves a dashboard at `:3001`. There is no CI mode, no GitHub Actions integration, no cloud team dashboard, no multi-project workspace in v1.0. The single question a developer should be able to answer after install: *"Does my component use the right design tokens?"* — in under 15 minutes. Everything else is v1.1+.

**Market position:** No existing tool — Applitools, Percy, Chromatic, Zeplin, Figma Dev Mode — offers embedded AST-based token compliance scanning connected to Figma as an installable product. PixelProof operates in a white space with a conservative TAM of $29M–$180M ARR at 5–10% capture of the addressable React+design-system market.

---

## 2. Problem Statement

### 2.1 Core Problem

React teams using design systems experience persistent drift between Figma design intent and code implementation. This drift manifests in two forms:

**Token Drift** — Developers hardcode style values (`#FF5733`, `16px`, `font-size: 14px`) instead of using the design system's token variables (`var(--color-primary-500)`, `var(--spacing-4)`, `var(--text-body-sm)`). This happens because:
- Designers express values visually in Figma; developers receive them as numeric specs
- No automated signal in the development workflow flags token violations
- ESLint catches syntax/logic errors but has no awareness of design system contracts

**Render Drift** — Even when tokens are used correctly in source code, the rendered output may not match Figma — due to CSS cascade issues, conflicting global styles, theme mismatches, or stale computed values. No current tool validates the gap between "what Figma says" and "what the browser renders" at the component level without a fully instrumented Storybook setup.

### 2.2 Why Current Tools Fall Short

| Tool Category | Gap |
|---|---|
| Visual regression (Applitools, Percy, Chromatic) | Screenshot-only; zero token layer awareness; Chromatic requires Storybook |
| Design handoff (Zeplin, Figma Dev Mode) | Pre-coding tools; cannot inspect live code; no compliance scoring |
| Code generation (Anima, Locofy) | Upstream (design → code generation); do not validate existing code |
| Custom ESLint plugins (Atlassian, MetaMask) | Bespoke engineering per design system; no Figma connection; no product |

**The result:** Teams either (a) manually review PRs for token compliance — expensive, slow, error-prone — or (b) skip the review entirely and accumulate drift silently until a visible incident forces a costly audit.

### 2.3 The Moment of Failure

The current failure mode is clear and well-documented in the market:

1. Design token updated in Figma (e.g., primary brand color shifts from `#0060DF` to `#0050C0`)
2. Style Dictionary regenerates CSS custom properties — `--color-primary-500` is updated
3. Product teams using `var(--color-primary-500)` update automatically
4. Product teams using hardcoded `#0060DF` in their JSX do not update
5. The hardcoded value ships to production
6. The incident is discovered at a design review, QA pass, or customer escalation — not at the PR

PixelProof catches this at step 4, before the PR is submitted.

---

## 3. Goals & Success Metrics

### 3.1 Product Goals (v1.0)

| # | Goal |
|---|---|
| G1 | Deliver accurate Token Compliance scoring from Figma token definitions via AST analysis |
| G2 | Deliver Render Fidelity scoring via iframe harness + Playwright computed style extraction |
| G3 | Produce actionable fix instructions at file + line granularity |
| G4 | Require zero Storybook dependency for all core functionality |
| G5 | Support W3C DTCG token format as primary input (with Style Dictionary output format as fallback) |
| G6 | Install and produce first results within 15 minutes for a new user |

### 3.2 Business Goals

| # | Goal | Horizon |
|---|---|---|
| B1 | 1,000 npm installs/week within 3 months of public launch | 3 months |
| B2 | 100 active team workspaces on paid tier within 6 months | 6 months |
| B3 | $50K MRR within 12 months | 12 months |
| B4 | Establish PixelProof as the reference tool for Figma-connected token validation | 18 months |

### 3.3 Success Metrics

| Metric | Target | Measurement Method |
|---|---|---|
| Time to first result | ≤ 15 minutes from `npm install` | Onboarding funnel analytics |
| False positive rate (AST engine) | < 5% of flagged violations are incorrect | User feedback + manual audit |
| AST scan time (local, 100 components) | < 10 seconds | Benchmark test suite |
| Token Compliance score accuracy | ≥ 95% vs manual audit | Quarterly audit on reference projects |
| Render Fidelity score accuracy | ≥ 90% vs manual visual review | Quarterly audit on reference projects |
| Free → paid conversion | ≥ 8% of active free users | Billing system |
| Net Promoter Score | ≥ 45 (developer tooling benchmark) | In-product survey |

---

## 4. User Personas

### Persona 1: Design Systems Lead (Primary Buyer)

**Name:** Morgan, Design Systems Lead
**Company size:** 50–500 engineers
**Context:** Leads a team of 2–6 engineers maintaining a component library consumed by 5–20 product teams.

**Pain:**
- Product teams ship components with hardcoded values instead of tokens — Morgan's team discovers this during quarterly audits or post-launch incidents
- Every major Figma token update (rebrand, theme expansion) requires a manual sweep across all consuming products
- Design review cycles are extended because devs re-submit PRs after failing visual checks
- Morgan cannot enforce token compliance at PR time without writing bespoke ESLint plugins per team

**Goal:** Automate token compliance enforcement so that product teams self-correct before PR submission without requiring manual design review of every component.

**Purchase trigger:** A visible regression (wrong brand color shipped), or a design system v2.0 rollout requiring a compliance baseline.

**Budget authority:** Yes. Can approve $49–$149/month without manager approval. Enterprise procurement ($1K+/month) requires sign-off.

---

### Persona 2: Frontend Engineering Manager (Secondary Buyer)

**Name:** Sam, Frontend Engineering Manager
**Company size:** 20–200 engineers
**Context:** Manages 4–10 frontend engineers; company has a component library but no dedicated design systems team.

**Pain:**
- Design review is a bottleneck — Sam's team lacks the bandwidth to enforce visual fidelity manually
- Frontend engineers are unsure which values to use — they copy from Figma inspect and paste hex values directly
- No dashboarding or visibility into how compliant the codebase is with the design system

**Goal:** Give engineers a local tool that catches design drift before code review, reducing back-and-forth and shipping higher-quality UIs.

**Purchase trigger:** A headcount constraint forces automation; or a post-mortem flags a UI regression that could have been caught earlier.

---

### Persona 3: Senior Frontend Developer (Individual User)

**Name:** Alex, Senior Frontend Developer
**Context:** Individual contributor on a product team; experienced React developer but not always familiar with all design system tokens.

**Pain:**
- Gets rejected in design review because computed styles don't match Figma spec
- Figma Dev Mode shows what the value should be, but doesn't tell Alex what line of code has the wrong value
- Wants to catch token violations locally before submitting a PR — but no self-serve tool exists

**Goal:** Know that the component is correct before submitting the PR. Get exact file + line fix instructions, not just a screenshot diff.

**Purchase trigger:** PLG — downloads PixelProof after seeing it in a team Slack thread or a blog post recommendation.

---

## 5. Use Cases & User Stories

### UC-01: Local Pre-PR Validation (Individual Developer)

> As a senior frontend developer, I want to run PixelProof against my local changes before submitting a PR so that I can fix token violations before design review.

**Acceptance Criteria:**
- Running `npx pixelproof` launches a dashboard at `localhost:3001`
- Dashboard shows a list of components in `src/` with Token Compliance and Render Fidelity scores
- Each violation shows: file path, line number, current value, expected token, token variable name
- Render Fidelity diff shows a side-by-side: rendered component vs Figma frame

---

### UC-03: Figma Token Sync

> As a Design Systems Lead, I want PixelProof to pull token definitions directly from my Figma file so that the compliance engine always validates against the current design source of truth.

**Acceptance Criteria:**
- User provides a Figma file URL and API token in `.pixelproofrc`
- PixelProof fetches Figma Variables from the file via Figma API
- Tokens are cached locally (`.pixelproof/token-cache.json`) with a configurable TTL (default: 24 hours)
- Manual refresh available: `npx pixelproof --sync-tokens`
- Cache invalidation on Figma file version change (detected via `lastModified` from Figma API)

---

### UC-04: Codebase Compliance Dashboard

> As a Frontend Engineering Manager, I want a dashboard that shows the overall Token Compliance score across all components in the codebase so that I can identify and prioritize remediation.

**Acceptance Criteria:**
- Dashboard at `localhost:3001` shows aggregate Token Compliance % and Render Fidelity %
- Per-component drill-down: individual scores, violation list, fix instructions
- Inline code view with violations highlighted at file + line level

---

### UC-05: Design System Migration Audit

> As a Design Systems Lead launching a v2.0 token scheme, I want to scan the entire codebase for usage of deprecated token values so that I can generate a migration report before the launch.

**Acceptance Criteria:**
- PixelProof accepts a "deprecated tokens" list (from Figma or `.pixelproofrc`)
- Scans all src/ files for usage of deprecated token names or their resolved values
- Outputs a migration report: which files, which components, which tokens, suggested replacement
- Report exportable as Markdown or JSON

---

### UC-06: Component Render Fidelity Comparison

> As a senior frontend developer, I want to see a pixel-level comparison of my rendered component against the Figma spec so that I can identify visual drift beyond just token violations.

**Acceptance Criteria:**
- PixelProof renders the component in an isolated iframe at `localhost:3001`
- Playwright captures a screenshot
- Figma API provides the reference frame image
- Side-by-side diff is shown in the dashboard with a pixel diff overlay
- Render Fidelity score reflects percentage of pixels within tolerance

---

## 6. Product Features

### Feature Set Summary

**v1.0 features only.** CI Mode, GitHub Actions integration, Team Dashboard, multi-project workspace, and historical trends are v1.1+. See Section 12.

| Feature | Tier | Priority |
|---|---|---|
| AST Token Compliance Scanner | Free + Paid | P0 |
| Local Dashboard (`:3001`) | Free + Paid | P0 |
| File + Line Fix Instructions | Free + Paid | P0 |
| Figma Token Sync (PAT — API pull + local cache) | Paid | P0 |
| Render Fidelity Scoring (Playwright) | Paid | P1 |
| Render Fidelity Diff Viewer | Paid | P1 |
| Design System Migration Audit | Paid | P2 |
| Deprecated Token Detection | Paid | P2 |
| SSO / SAML | Enterprise | P3 |
| SLA + Priority Support | Enterprise | P3 |
| Custom Webhook / Slack Integration | Enterprise | P3 |

---

### F-01: AST Token Compliance Scanner

**Description:** Static analysis of React/TypeScript source files to detect style values that should be design tokens.

**Detection targets:**
- Hardcoded hex colors in JSX (`color="#FF5733"`, `backgroundColor: '#FF5733'`)
- Hardcoded RGB/RGBA values
- Hardcoded spacing values in CSS-in-JS (`margin: 16`, `padding: '8px'`)
- Hardcoded font sizes, line heights, border radii
- Raw SCSS/CSS variable assignments that don't reference the token namespace

**Supported file formats:** `.tsx`, `.ts`, `.jsx`, `.js`, `.css`, `.scss`, `.css.ts` (vanilla-extract), styled-components template literals

**Output per violation:**
```
[VIOLATION] src/components/Button/Button.tsx:42
  Found: color="#FF5733"
  Expected token: var(--color-primary-500)
  Figma token: colors/primary/500 → #FF5733
  Fix: Replace with `color={tokens.colorPrimary500}` or `color="var(--color-primary-500)"`
```

---

### F-02: Figma Token Sync

**Description:** Pulls design token definitions from Figma Variables API and caches them locally.

**Authentication (v1.0):** Personal Access Token (PAT) only. User generates a PAT in Figma account settings and provides it via `FIGMA_PAT` environment variable or `.pixelproofrc`. OAuth is deferred to v1.1 (requires Figma app registration and review — indeterminate timeline). The primary ICP (Design Systems Lead) is technical enough to generate a PAT.

**Token pull strategy:**
1. Authenticate with Figma API using user-provided Personal Access Token (PAT)
2. Fetch Figma Variables from the configured file ID
3. Resolve alias chains to get final computed values
4. Export as W3C DTCG-compatible JSON to `.pixelproof/token-cache.json`
5. Cache TTL: 24 hours by default, configurable

**Fallback:** If Figma API is unreachable, use local cache. If no cache exists, fall back to `tokens/` directory (Style Dictionary output) if present.

**Token format support:**
- **Primary:** W3C DTCG (`.tokens.json` / Figma Variables export format)
- **Secondary:** Style Dictionary output (CSS custom properties, JS token objects)
- **Tertiary:** Token Studio Figma plugin export format

---

### F-03: Local Dashboard

**Description:** A web dashboard served at `localhost:3001` providing an interactive component compliance view.

**Dashboard sections:**

1. **Overview Panel**
   - Aggregate Token Compliance % (across all scanned components)
   - Aggregate Render Fidelity % (paid tier)
   - Total violations count
   - Last sync timestamp (Figma token cache)

2. **Component List**
   - Per-component Token Compliance score
   - Per-component Render Fidelity score (paid)
   - Click to drill into component detail

3. **Component Detail View**
   - Source file path and component name
   - Token Compliance violation list (file + line + value + fix)
   - Render Fidelity side-by-side diff (paid)
   - Inline code view with violations highlighted

4. **Token Reference Panel**
   - Full list of tokens synced from Figma
   - Search/filter by token category (color, spacing, typography)
   - Shows alias chain and resolved value

---

### F-04: CI Mode *(Deferred — v1.1)*

CI headless mode (`npx pixelproof --ci`), GitHub Actions integration, PR comment posting, and JSON report artifacts are deferred to v1.1. See Section 12 (Out of Scope) for details.

---

### F-05: Dual Score Architecture

**Description:** PixelProof always presents two distinct scores per component:

| Score | Source | What it measures |
|---|---|---|
| **Token Compliance %** | AST analysis | % of style properties using correct design tokens vs hardcoded values |
| **Render Fidelity %** | Playwright + computed styles | % of visual properties matching Figma spec at runtime |

These scores are deliberately separate because they measure different failure modes:
- A component can have 100% token compliance but 70% render fidelity (token resolves to wrong value due to CSS cascade)
- A component can have low token compliance but high render fidelity (hardcoded correct hex values)

Both signals are required for full confidence.

---

## 7. Functional Requirements

### 7.1 Configuration

PixelProof is configured via `.pixelproofrc` (JSON or YAML) at the project root:

```yaml
# .pixelproofrc.yaml
figma:
  fileId: "abc123..."
  personalAccessToken: "${FIGMA_PAT}"   # environment variable reference
  syncTTL: 86400                        # seconds (24 hours)

scan:
  include:
    - "src/components/**"
    - "src/features/**"
  exclude:
    - "**/*.test.tsx"
    - "**/*.stories.tsx"
    - "**/node_modules/**"
  fileTypes: ["tsx", "ts", "jsx", "js", "css", "scss"]

tokens:
  format: "dtcg"                        # "dtcg" | "style-dictionary" | "token-studio"
  fallbackDir: "tokens/"                # local fallback if Figma unreachable

dashboard:
  port: 3001

render:
  enabled: true
  viewport: { width: 1440, height: 900 }
  tolerance: 4                          # pixel tolerance for fidelity comparison (ADR-OQ-06: 4px accounts for anti-aliasing)
  theme: "light"                        # "light" | "dark" | "system" — single theme per run
  components:                           # optional per-component render overrides
    DataTable:
      mockProps:                         # inline static objects only (ADR-NQ-02; external file paths deferred to v1.1)
        rows: []
        columns: ["Name", "Email"]
    UserAvatar:
      mockProps:
        name: "Jane Doe"
        imageUrl: "https://example.com/avatar.png"
```

### 7.2 Component Discovery

- PixelProof discovers React components automatically by scanning the `include` paths
- A "component" is defined as any file exporting a React component (detected via AST — `export function`, `export const` returning JSX, `export default`)
- Components do not need to be registered, cataloged, or have stories written

### 7.3 Token Resolution

- PixelProof resolves Figma alias chains fully (e.g., `colors/brand/primary` → `colors/palette/blue-600` → `#0050C0`)
- Stores both alias name and resolved value in the local cache
- AST scanner matches against both (catches both `var(--colors-palette-blue-600)` and `#0050C0`)

### 7.4 Iframe Harness (Render Fidelity)

- PixelProof injects a lightweight runtime script into the project's dev server (Vite, webpack, Create React App, Next.js dev)
- The harness proxies `localhost:3000` (or configured app port) to render individual components in isolation within an iframe at `localhost:3001`
- No component story files required — components are rendered using a default render (zero props by default)
- For components requiring context (Redux store, theme provider), PixelProof wraps with detected provider patterns from the app's `main.tsx` / `App.tsx`

**Render Failure Handling:**

Each component render is wrapped in a React error boundary. If a component throws during zero-prop render (e.g., it requires non-nullable props to be functional):
- The component is marked **"render skipped — props required"** in the dashboard with a distinct visual state
- Token Compliance scoring via AST still runs normally for the skipped component
- Skipped components are excluded from the aggregate Render Fidelity % calculation and do not penalise the overall score
- A warning banner is shown in the dashboard for all skipped components

**MockProps Config (Optional):**

Users can provide per-component mock props in `.pixelproofrc` under `render.components`:
```yaml
render:
  components:
    DataTable:
      mockProps:
        rows: []
        columns: ["Name", "Email"]
```
Mock props are inline static objects defined directly in `.pixelproofrc` (JSON-compatible plain objects). External mock file paths are deferred to v1.1 (ADR-NQ-02). When provided, PixelProof uses those props instead of zero-prop render, enabling full Render Fidelity scoring for the component.

**Theme:**

PixelProof scores render fidelity against a single theme per run (default: `light`). Teams supporting both light and dark themes run two separate PixelProof checks with `render.theme: "light"` and `render.theme: "dark"` respectively. This avoids false positives from theme-variant token differences.

### 7.5 Playwright Integration (Render Fidelity)

- PixelProof launches a Playwright Chromium instance (bundled as a Playwright dependency)
- Captures screenshots of each component in the iframe harness
- Extracts CSS computed property values for all style properties declared in the component's stylesheet
- Compares computed values against Figma spec values (from token cache)
- Pixel diff produced using `pixelmatch`

---

## 8. Technical Requirements

### 8.1 Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| CLI runner | Node.js ≥ 18 | LTS, widespread adoption |
| AST parser | `@babel/parser` + `@babel/traverse` (TSX support) | Battle-tested, handles all JSX/TSX syntax |
| CSS/SCSS parser | `postcss` + `postcss-scss` | Standard tool; handles both |
| Token cache | JSON file in `.pixelproof/` | Simple, version-control friendly |
| Figma API client | Figma REST API v1 | Only stable, documented API |
| Dashboard UI | React + Vite (bundled into PixelProof) | Fast dev, familiar stack |
| Runtime harness | Vite plugin + iframe injection | Non-invasive, works with any bundler |
| Screenshot capture | Playwright (Chromium) | Reliable cross-platform headless browser |
| Pixel diff | `pixelmatch` | Lightweight, no native deps |

### 8.2 Token Format Support

| Format | Support Level |
|---|---|
| W3C DTCG (`application/design-tokens+json`) | Primary — full support |
| Style Dictionary CSS custom properties output | Full support |
| Style Dictionary JS/TS export | Full support |
| Token Studio Figma plugin export | Full support (via format converter) |
| SCSS variables | Read-only (detect violations; cannot write SCSS tokens) |
| Raw hardcoded JS constant files | Detection only (flag as violation) |

### 8.3 Framework Support

| Framework | AST Scanner | Render Harness |
|---|---|---|
| React (CRA, Vite) | ✅ | ✅ |
| Next.js (App Router) | ✅ | ✅ (client components only) |
| Next.js (Pages Router) | ✅ | ✅ |
| Remix | ✅ | Planned (v1.1) |
| Vue | Planned (v2.0) | Planned (v2.0) |
| Angular | Out of scope | Out of scope |

### 8.4 CSS-in-JS Support

| Library | AST Detection | Runtime Extraction |
|---|---|---|
| Inline styles (JSX style prop) | ✅ | ✅ |
| CSS Modules | ✅ | ✅ |
| styled-components | ✅ (template literal parsing) | ✅ |
| Emotion | ✅ | ✅ |
| vanilla-extract (`.css.ts`) | ✅ | ✅ |
| Tailwind CSS | Planned (v1.2) — token mapping | Planned |

### 8.5 Performance Requirements

| Operation | Requirement |
|---|---|
| AST scan (100 components) | < 10 seconds |
| Figma token sync (first pull) | < 30 seconds |
| Figma token sync (cached) | < 1 second |
| Dashboard initial load | < 3 seconds |
| Per-component render + screenshot | < 5 seconds |
| Full render fidelity run (20 components) | < 2 minutes |

### 8.6 Data Privacy

- Figma PAT is stored only in environment variables or local `.env` — never committed
- Source code is analyzed locally only — no code is transmitted to PixelProof servers
- Figma token definitions are cached locally in `.pixelproof/` (gitignore by default)
- For paid tier: only aggregate scores and violation counts are transmitted to the PixelProof cloud dashboard — no source code content

---

## 9. Non-Functional Requirements

### 9.1 Installation Experience

- `npm install --save-dev pixelproof` must succeed with zero native module compilation steps
- Playwright's Chromium binary is downloaded on first use (`pixelproof install`) — not on npm install, to keep install fast
- Total install size (without Chromium): < 50MB

### 9.2 Zero Storybook Dependency

- PixelProof must not require, import, or depend on Storybook in any form
- Component discovery must work without story files

### 9.3 Minimal App Instrumentation

- PixelProof must not require changes to the application's source code
- The only required changes are adding `.pixelproofrc` and running `npx pixelproof`
- Optional: adding a `pixelproof` npm script to `package.json`

### 9.4 Security

- Figma PAT is never logged, never echoed to stdout, never included in any output
- No telemetry collected without explicit opt-in
- Opt-in telemetry collects: npm version, Node version, framework detected, scan duration — never file contents

### 9.5 Compatibility

- Node.js ≥ 18.0.0 (LTS)
- Windows, macOS, Linux

---

## 10. Pricing & Packaging

### Tier Structure

| Feature | Free | Team ($49/mo) | Pro ($149/mo) | Enterprise (custom) |
|---|---|---|---|---|
| AST Token Compliance Scanner | ✅ Unlimited | ✅ | ✅ | ✅ |
| Local Dashboard (`:3001`) | ✅ | ✅ | ✅ | ✅ |
| File + Line Fix Instructions | ✅ | ✅ | ✅ | ✅ |
| Figma Token Sync | ❌ | ✅ | ✅ | ✅ |
| Render Fidelity Scoring | ❌ | ✅ 5 components | ✅ Unlimited | ✅ |
| Render Fidelity Diff Viewer | ❌ | ✅ | ✅ | ✅ |
| Migration Audit | ❌ | ❌ | ✅ | ✅ |
| Slack / Webhook Integration | ❌ | ❌ | ✅ | ✅ |
| SSO / SAML | ❌ | ❌ | ❌ | ✅ |
| SLA | ❌ | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ❌ | ✅ Email | ✅ Dedicated CSM |

### Free Tier — Works Without Figma

The free tier delivers genuine value without a Figma connection. AST Token Compliance scanning runs against a **local token file** (`tokens/` directory — Style Dictionary output or any W3C DTCG JSON file). No Figma account, no PAT, no internet required.

**Free tier positioning:** *"Works offline. Connects to Figma when you're ready."*

This ensures free users are retained and productive before hitting the upgrade prompt.

### Monetization Gates

- **Free → Team:** Figma API access (requires PAT — the natural upgrade moment when the team is ready to connect the live source of truth)
- **Team → Pro:** Unlimited render fidelity + migration audit + Slack integration
- **Pro → Enterprise:** SSO, SLA, dedicated support, custom reporting

### Billing Model

- Monthly or annual (20% discount annual)
- Team tier billed per workspace (not per seat up to 5 members)
- Pro tier billed per workspace (up to 25 members)
- Enterprise: custom contract

---

## 11. Go-to-Market

### 11.1 Distribution Model

**PLG (Product-Led Growth) — primary motion**

- Installation via npm: `npm install --save-dev pixelproof`
- Free tier is fully functional for AST scanning — genuine value before paywall
- Upgrade prompt triggered at Figma sync attempt (requires Figma PAT connection)
- No sales touch required for Free → Team → Pro conversion

### 11.2 Target Customer

**Primary ICP:** Design Systems Lead or Frontend Engineering Manager at a company with:
- 20–500 engineers
- An active React component library / design system
- A Figma file used as design source of truth
- 3+ product teams consuming the design system

**Secondary ICP:** Individual senior frontend developer on a team with a design system

### 11.3 Acquisition Channels

| Channel | Tactic |
|---|---|
| npm organic | Quality README, keyword optimization, "Used by" badges |
| Developer content | Blog posts: "How we reduced design drift 80% with PixelProof", "ESLint plugins for design tokens vs PixelProof" |
| Design system community | Sponsor/contribute to Design Tokens Community Group, Token Studio community |
| Figma plugin ecosystem | Figma plugin companion to surface PixelProof results in Dev Mode |
| Twitter/X / LinkedIn | Design systems engineers, design systems newsletter sponsorships |
| GitHub | Open source AST core; paid cloud tier |

### 11.4 Messaging

**Primary tagline:** "Catch token violations before code review."
**Secondary tagline:** "Figma-connected. No Storybook required."
**Free tier tagline:** "Works offline. Connects to Figma when you're ready."
**Elevator pitch:** "PixelProof is a devDependency that tells you, at file and line level, exactly where your React components use hardcoded values instead of design tokens — by pulling the source of truth directly from Figma."

### 11.5 Competitive Positioning

| Vs. Chromatic | "Chromatic requires Storybook. PixelProof works with any React project." |
|---|---|
| Vs. Percy/Applitools | "Screenshot tools can't tell a token violation from a correct render. PixelProof knows the difference." |
| Vs. Figma Dev Mode | "Dev Mode shows you what the value should be. PixelProof tells you where your code uses the wrong value." |
| Vs. ESLint plugins | "Custom ESLint plugins take weeks to build and have no Figma connection. PixelProof installs in 5 minutes." |

---

## 12. Out of Scope

The following are explicitly out of scope for v1.0:

| Item | Rationale |
|---|---|
| Vue, Angular, Svelte support | React-first to validate core engine; framework expansion in v2.0 |
| Design-to-code generation | Different problem domain (code generation vs validation) |
| Figma plugin (built into Figma UI) | Companion plugin planned for v1.1; core value is in the dev environment |
| Replacing Storybook entirely | PixelProof is a validator, not a component development environment |
| Automated code fixes (auto-replace violations) | Too risky for v1.0; manual fix instructions are safer first step |
| Mobile (React Native) | Out of scope; web React only |
| Server-side rendering validation | Client-side component rendering in iframe only |
| WCAG / accessibility auditing | Out of scope; separate problem domain |
| Figma → code generation | PixelProof validates; it does not generate |
| Design token authoring / editing | PixelProof reads tokens; it does not write to Figma |
| Multi-framework (mixed React + Vue) monorepos | v1.0 scans one framework per project |
| **Tailwind CSS token mapping** | Tailwind's config-based utility class system is architecturally distinct from CSS custom properties. Requires a dedicated mapping layer. Planned for v1.2. |
| **Figma OAuth** | Requires Figma app registration and review (indeterminate timeline). PAT is sufficient for ICP. OAuth deferred to v1.1. |
| **CI Mode (headless AST gate)** | `npx pixelproof --ci` headless mode deferred to v1.1. v1.0 is local-only. |
| **GitHub Actions integration** | GitHub Actions step, `pixelproof-action`, PR comment posting via `GITHUB_TOKEN` all deferred to v1.1. |
| **Team Dashboard** | Multi-project workspace and cross-project compliance view deferred to v1.1. |
| **Historical trend charts** | Compliance score over time tracking deferred to v1.1 (requires persistent storage). |
| **Compliance Score Export (JSON/CSV)** | Report export deferred to v1.1. |

---

## 13. Risks & Dependencies

### 13.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Figma API rate limits block token sync | Medium | High | Local cache with 24h TTL; graceful degradation to cache |
| Figma API changes break token fetch | Low | High | Abstract API client behind interface; monitor Figma changelog |
| AST parser fails on edge-case syntax (e.g., eval, dynamic styles) | Medium | Medium | Skip unresolvable patterns with warning; no false confidence |
| Playwright Chromium download fails in restricted CI environments | Medium | Medium | Provide `--no-render` flag; document CI allowlist requirements |
| CSS computed style extraction inaccurate for complex cascade | Medium | High | Conservative fidelity scoring; document known limitations |

### 13.2 Competitive Risks

| Risk | Probability | Timeline | Mitigation |
|---|---|---|---|
| Figma builds VS Code extension with AST validation | Medium | 12–18 months | Faster execution; multi-framework support; Figma dependency is a vulnerability for teams not using Figma |
| Chromatic removes Storybook dependency | Low | 18–24 months | PixelProof's token-layer depth is differentiated regardless |
| Atlassian / Shopify open-sources internal token validation tooling | Medium | 12 months | Validates market; compete on Figma integration and UX |
| ESLint plugin commoditization accelerates | High | 6–12 months | PixelProof's value is the Figma sync + dual score + no-config experience; raw ESLint plugins always require custom engineering |

### 13.3 Dependencies

| Dependency | Risk Level | Notes |
|---|---|---|
| Figma REST API | Medium | No official SLA; Figma is key infrastructure |
| W3C DTCG format stability | Low | Stable v1.0 released Oct 2025 |
| Playwright Chromium | Low | Well-maintained Microsoft project |
| `@babel/parser` | Low | Stable, widely used |
| Node.js LTS | Low | Stable 2-year LTS cycle |

---

## 14. Open Questions

### Resolved

| # | Question | Decision | Decided By |
|---|---|---|---|
| OQ-01 | Should Figma OAuth be supported at launch, or PAT-only for v1.0? | **PAT only for v1.0. OAuth in v1.1.** OAuth requires Figma app registration with indeterminate review timeline. ICP (Design Systems Lead) is technical enough to generate a PAT. | ThejeshMulinja, 2026-03-20 |
| OQ-02 | How should PixelProof handle components that require non-trivial props to render? | **Zero-prop render by default; error boundary catches failures → "render skipped — props required".** Token Compliance (AST) still runs. Optional `render.components[Name].mockProps` config in `.pixelproofrc` for teams that want full Render Fidelity on those components. Skipped components excluded from aggregate Render Fidelity % score. | ThejeshMulinja, 2026-03-20 |
| OQ-07 | Is Tailwind CSS support required for v1.0 or v1.1? | **Not in v1.0. Planned v1.2** with a dedicated mapping layer. Tailwind's utility-class token system is architecturally distinct from CSS custom properties and requires separate engineering. | ThejeshMulinja, 2026-03-20 |
| OQ-08 | How does PixelProof handle dynamic theming / dark mode? | **Single theme per run (default: `light`). Configurable via `render.theme` in `.pixelproofrc`** (`"light"` / `"dark"` / `"system"`). Teams with both themes run two separate checks. Prevents false positives from theme-variant token differences. | ThejeshMulinja, 2026-03-20 |
| OQ-09 | What is the monetization trigger if a user never connects Figma? | **Free tier is fully valuable without Figma** — AST scanner runs against a local token file (`tokens/` directory). Figma sync is the upgrade trigger, not a prerequisite. Free tier tagline: *"Works offline. Connects to Figma when you're ready."* | ThejeshMulinja, 2026-03-20 |
| OQ-10 | Should the CI report include a PR comment (via GitHub Actions)? | **Entire CI Mode deferred to v1.1.** v1.0 scope revised to local-only. PR comment via GITHUB_TOKEN is the right approach when CI mode ships in v1.1 — decision stands, timeline shifts. | ThejeshMulinja, 2026-03-20 |

### Still Open

| # | Question | Owner | Priority |
|---|---|---|---|
| OQ-03 | Should the Token Compliance score weight violations by token type (e.g., color violations = higher weight than spacing)? | Product | Medium |
| OQ-04 | What is the gitignore strategy for `.pixelproof/`? Token cache can contain Figma file structure information — is that sensitive? | Security | Medium |
| OQ-05 | Should PixelProof support `.env` file auto-detection for `FIGMA_PAT`, or require explicit `.pixelproofrc` config? | Engineering | Medium |
| OQ-06 | What is the right Render Fidelity tolerance default? 2px may be too strict for anti-aliasing differences. | Engineering | Medium |

### New Questions (Emerged from OQ Decisions)

| # | Question | Triggered By | Owner | Priority |
|---|---|---|---|---|
| NQ-01 | What error UX should PixelProof show when a PAT is expired or revoked mid-sync? Should it surface a specific diagnostic (token expired, permission denied) vs a generic API failure? | OQ-01 (PAT-only) | Engineering | Medium |
| NQ-02 | Should the `mockProps` file support TypeScript factory functions (e.g., `export default () => ({ rows: generateRows() })`) in addition to plain static objects? | OQ-02 (mockProps config) | Engineering | Medium |
| NQ-03 | Should "render skipped" components appear with a distinct visual state in the dashboard warning indicator? What should the visual treatment be? | OQ-02 (render skipped) | Product | Medium |
| NQ-04 | Should PixelProof support running both light and dark theme checks in a single local invocation with separate output per theme? Or is running twice with different config the explicit recommendation? | OQ-08 (single theme per run) | Product | Low |
| NQ-05 | Should the PR comment be updated in-place on subsequent commits to the same PR (requires finding and editing the previous comment), or posted as a new comment each time? | OQ-10 (PR comment — v1.1) | Engineering | Low — revisit when CI Mode scoped for v1.1 |

---

*Document created: 2026-03-20*
*Last updated: 2026-03-20 — Scope revised to local-only v1.0; CI Mode, GitHub Actions, Team Dashboard, multi-project, export deferred to v1.1; NQ-06 retired*
*Research source: domain-ui-design-to-code-fidelity-validation-research-2026-03-20.md*
*Next step: Hand to Architect — resolve OQ-03/04/05/06 and NQ-01/02/03/04 in architecture phase as needed*
