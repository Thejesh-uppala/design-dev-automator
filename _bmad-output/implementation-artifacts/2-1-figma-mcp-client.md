# Story 2.1: Figma MCP Client

Status: review

## Story

As a developer,
I want PixelProof to fetch design tokens from a Figma MCP server,
so that token syncing works automatically in MCP-enabled editors without PAT configuration.

## Acceptance Criteria

1. Calls Figma MCP server to fetch local variables for the configured `figma.fileId`
2. Returns raw Figma variable data: variable collections, modes, variable names, values, and alias references
3. Detects whether MCP is available (MCP server running + Figma tool accessible) — returns `null` if unavailable (does NOT throw)
4. Timeout: 30 seconds max for MCP call
5. MCP connection errors are caught and logged as warnings, not thrown — allows fallback to next tier
6. Raw output is a normalized intermediate format (`RawFigmaVariables`) — NOT yet converted to `TokenMap`

## Tasks / Subtasks

- [x] Task 1: Define shared Figma types
  - [x] 1.1: Create `src/tokens/figma-types.ts` with `RawFigmaVariables`, `RawFigmaVariable`, `RawFigmaVariableCollection`, `FigmaColor`, `FigmaVariableAlias`
- [x] Task 2: Implement MCP client
  - [x] 2.1: Create `src/tokens/figma-mcp.ts` with `fetchViaFigmaMCP(fileId)`
  - [x] 2.2: Dynamic import of `@modelcontextprotocol/sdk` — returns `null` if SDK not installed
  - [x] 2.3: Configurable MCP server command via `FIGMA_MCP_COMMAND` / `FIGMA_MCP_ARGS` env vars
  - [x] 2.4: 30-second timeout using `Promise.race`
  - [x] 2.5: `normalizeMCPResponse()` — normalize MCP tool result to `RawFigmaVariables`
  - [x] 2.6: Extract content from MCP tool result format (`{ content: [{ type: 'text', text: '...' }] }`)
- [x] Task 3: Write tests
  - [x] 3.1: Test `normalizeMCPResponse` with standard Figma API structure
  - [x] 3.2: Test `normalizeMCPResponse` with flat structure (no meta wrapper)
  - [x] 3.3: Test empty variables/collections handling
  - [x] 3.4: Test fallback ID from entry key
  - [x] 3.5: Test `fetchViaFigmaMCP` returns null when SDK not available

## Dev Notes

### Files Created

```
pixelproof/
  src/tokens/figma-types.ts       # Shared Figma variable types
  src/tokens/figma-mcp.ts         # MCP client
  src/tokens/__tests__/figma-mcp.test.ts
```

### Design Decisions

- MCP SDK (`@modelcontextprotocol/sdk`) is dynamically imported — NOT a hard dependency
- If SDK not installed, MCP path returns `null` immediately (zero overhead)
- MCP server command configurable via env vars for flexibility
- `normalizeMCPResponse` is exported for direct testing of the normalization logic

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- `fetchViaFigmaMCP()` — dynamic MCP SDK import, 30s timeout, null on any failure
- `normalizeMCPResponse()` — handles both `meta`-wrapped and flat responses
- `RawFigmaVariables` shared type with `RawFigmaVariable`, `RawFigmaVariableCollection`, `FigmaColor`, `FigmaVariableAlias`
- 5 new tests, zero regressions

### File List

- `pixelproof/src/tokens/figma-types.ts` (new)
- `pixelproof/src/tokens/figma-mcp.ts` (new)
- `pixelproof/src/tokens/__tests__/figma-mcp.test.ts` (new)

### Change Log

- 2026-03-22: Story 2.1 implemented — Figma MCP client with dynamic SDK import, timeout, response normalization
