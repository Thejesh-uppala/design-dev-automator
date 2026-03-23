---
stepsCompleted: [1, 2, 3-phase1, 3-phase2, 3-phase3]
inputDocuments: []
session_topic: 'Real-time UI confidence scoring engine — Figma-to-frontend fidelity scoring (0–100) across color tokens, typography, spacing, border radius, component states, and WCAG'
session_goals: 'Adversarial challenge — expose weak assumptions across 5 risk areas: technical scoring assumptions, accuracy definition, trust model, failure modes, MVP scope'
selected_approach: 'ai-recommended'
techniques_used: ['Assumption Reversal', 'Reverse Brainstorming', 'Chaos Engineering']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** ThejeshMulinja
**Date:** 2026-03-20

## Session Overview

**Topic:** Real-time UI confidence scoring engine — Figma-to-frontend fidelity scoring (0–100) across color tokens, typography, spacing, border radius, component states, and WCAG
**Goals:** Adversarial challenge — expose weak assumptions across 5 risk areas before committing to build

### Session Setup

Adversarial mode. Goal is to stress-test core assumptions, generate failure modes, and identify what must NOT be built in MVP.

---

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** High-stakes product with unvalidated technical assumptions, needing maximum adversarial pressure before commitment

**Recommended Techniques:**

- **Assumption Reversal:** Flip every core assumption to expose what the product is actually betting on
- **Reverse Brainstorming:** Generate all the ways the product fails — then work backwards to survival conditions
- **Chaos Engineering:** Stress-test the scoring engine concept against worst-case real-world conditions

**Final Architecture Decisions:**
- Decision 1: No Storybook dependency. Own iframe harness. Storybook auto-detected as enhancement.
- Decision 2: CI = AST only (token compliance). Local = AST + Runtime (render fidelity). Two named scores, different contexts.
- Decision 3: Figma REST + local cache in v1. MCP in v2.
- Build sequence: Sprint 1 AST → Sprint 2 Iframe → Sprint 3 Dashboard → Sprint 4 Figma sync → Sprint 5 CI → Sprint 6 Storybook + MCP

**AI Rationale:** User explicitly requested aggressive challenge mode. Three-phase adversarial sequence: expose assumptions → generate failure modes → stress-test survivors. No creative ideation until the foundation holds.

---

## Architectural Decision — Co-Located Embedded Model (PixelProof)

**Product name:** PixelProof
**Execution model:** Co-located devDependency, not SaaS or standalone CLI

```
your-project/
├── src/
├── .pixelproof/
│   ├── config.js          ← component mappings + thresholds
│   ├── dashboard/         ← scoring dashboard UI
│   └── engine/            ← scoring, diff, capture
└── package.json           ← added as devDependency
```

**Startup:** `next dev & pixelproof serve` → app on :3000, dashboard on :3001

**Two-engine hybrid:**
- Engine 1 (Runtime): Playwright captures from :3000, getComputedStyle() → WHAT is rendering wrong
- Engine 2 (Static): AST walker reads src/ directly → WHERE to fix it, exact file + line
- Combined: only possible because of filesystem co-location

**Figma token source:**
- Option A (preferred): Figma MCP server — no REST client, tokens on demand
- Option B (fallback): Figma REST API + local cache in `.pixelproof/cache/figma-tokens.json`

**Pattern:** Storybook model — co-locate, dev server, port alongside. Proven adoption pattern.

**What this architecture resolves from Phase 2:**
- CSS-in-JS (#3): AST walker finds source directly
- SSR/Next.js (#9): Playwright hits localhost:3000, AST needs no DOM
- Tailwind (#4): AST reads tailwind.config.js
- Monorepo (#8): .pixelproof/config.js specifies per-package mappings

---

## Phase 2: Reverse Brainstorming — Decisions

### Responses to Three Critical Failure Modes

**CSS-in-JS (#3) — v1 Requirement, not v2:**
`getComputedStyle()` still gives rendered value. Fix instruction changes to component file + prop name via source maps. "In Button.tsx, background prop resolves to #818cf8. Expected: var(--color-primary)." Source map parsing required. Sprint 1 spike — validate against Emotion + styled-components before any scoring code is written.

**Threshold (#9) — Product default is 85%, non-negotiable:**
Strong default like ESLint. Teams can lower it but default is opinionated and publicly defended via validation dataset. 30-day grace period on install: scores visible but do not block PRs. Solves first-scan demoralization failure mode.

**Figma ships it (#17) — Moat is the developer workflow:**
Figma cannot ship: CI/CD pipeline integration, fix instructions with live CSS access, PR-level historical score tracking, or a validated accuracy benchmark. Moat is that we live in the developer workflow. Figma lives in the design workflow. The gap between them is the product.

---

## Phase 1: Assumption Reversal — Results

**12 assumptions surfaced and challenged. Key outcomes:**

### Decisions Made

| Decision | Ruling |
|---|---|
| Engine 1 (token diff) owns the score | Deterministic, reproducible, explainable |
| Engine 2 (vision AI) is presentation-only | Zero score contribution. On-demand, opt-in, dashboard only |
| Vision AI cost model | On-demand click triggers only — ~$10-30/month per team vs $1,200 |
| Enterprise privacy | Vision AI fully disableable — no screenshots leave infrastructure |
| Vision AI framing | "Visual context for token diffs" — never "like a human reviewer" |
| MVP dimensions | Color tokens + spacing only (v1). Typography, border radius, states = v2 |
| WCAG | Fully separated. Design system health check only, never a score modifier |
| Ground truth dataset | Requires 200+ components, 5+ real teams, dual labeling — 3-month research pre-build |

### Revised MVP Architecture

- **Engine 1 (token diff):** Color tokens + spacing only
- **Score:** Deterministic, Engine 1 only, 0–100
- **CI:** Token diff on every PR — fast, no external API calls
- **Dashboard:** Side-by-side screenshots (static, no AI)
- **Vision AI:** On-demand only, opt-in, dashboard only — v2 enhancement

### Core Value Statement (locked)

> "We are the only tool that tells a developer WHICH token is wrong and WHAT the correct value should be. Percy tells you a pixel moved. We tell you: Button is using #818cf8. Your design system token --color-primary is #6366f1. Fix: replace hardcoded hex with var(--color-primary)."

### Open Risks Carried Forward

1. CSS-to-token reverse lookup mapping layer — who builds it, who maintains it
2. Spacing comparison algorithm — box model, margin collapse, breakpoints unsolved
3. Ground truth validation dataset — not yet scoped or resourced
4. Figma Variables API stability — no mitigation strategy yet

---
