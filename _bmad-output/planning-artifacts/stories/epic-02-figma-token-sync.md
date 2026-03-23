# Epic 2: Figma Token Sync + Local Cache

**Goal:** After E2, PixelProof can fetch design tokens from Figma (via MCP or REST API), resolve aliases, cache them locally, and fall back gracefully when Figma is unavailable. The token cache produced is identical regardless of source.

**Depends on:** E1 (config loader, token types, alias resolver, cache writer)
**Parallel with:** E3 (AST engine). E2 and E3 share the `TokenMap` interface from E1-S3 but are otherwise independent.
**Unlocks:** E4 (iframe harness — needs token data for provider detection context), E5 (render fidelity — needs Figma reference images via nodeIds)

---

## Token Fetch Hierarchy (Locked Decision)

```
1. Figma MCP   ← preferred (zero config, editor handles auth)
2. REST API + PAT  ← fallback (for non-MCP editors)
3. Local tokens/   ← offline fallback (already built in E1-S5)
```

Same `TokenMap` output from all three sources. Only the fetch layer differs.

---

## E2-S1: Figma MCP Client

### Description

Implement a client that calls the Figma MCP server to fetch variables and component metadata from a Figma file. MCP handles authentication — no PAT management needed on this path.

### Files to Create

```
src/tokens/
  figma-mcp.ts       # fetchViaFigmaMCP(fileId) → RawFigmaVariables
```

### Acceptance Criteria

- [ ] Calls Figma MCP server to fetch local variables for the configured `figma.fileId`
- [ ] Returns raw Figma variable data: variable collections, modes, variable names, values, and alias references
- [ ] Detects whether MCP is available (MCP server running + Figma tool accessible) — returns `null` if unavailable (does NOT throw)
- [ ] Timeout: 30 seconds max for MCP call
- [ ] MCP connection errors are caught and logged as warnings, not thrown — allows fallback to next tier
- [ ] Raw output is a normalized intermediate format (`RawFigmaVariables`) — NOT yet converted to `TokenMap`

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| MCP available, valid fileId | Returns `RawFigmaVariables` with variable collections |
| MCP available, invalid fileId | Throws descriptive error: "Figma file not found: abc123" |
| MCP not available (no MCP server) | Returns `null`, logs warning |
| MCP timeout (>30s) | Returns `null`, logs warning |

### Notes

- The exact MCP tool names depend on the Figma MCP server implementation. Expected tools: `get_file_variables` or similar. Document the expected MCP tool interface at the top of the file.
- This client should be thin — just the MCP call + response normalization. No caching, no conversion.

---

## E2-S2: Figma REST API Client (PAT Fallback)

### Description

Implement the Figma REST API client using Personal Access Token authentication. This is the fallback when MCP is unavailable. Rate-limit aware with exponential backoff.

### Files to Create

```
src/tokens/
  figma-rest.ts      # fetchViaFigmaREST(fileId, pat) → RawFigmaVariables
```

### Acceptance Criteria

- [ ] Authenticates with Figma REST API using `X-FIGMA-TOKEN` header
- [ ] Fetches variables via `GET /v1/files/:file_key/variables/local`
- [ ] Also fetches published variables via `GET /v1/files/:file_key/variables/published` and merges (local takes precedence on conflict)
- [ ] On HTTP 429 (rate limited): retries with exponential backoff (1s, 2s, 4s) — max 3 retries
- [ ] On HTTP 403: throws "Figma PAT is invalid or expired. Generate a new token at figma.com/settings"
- [ ] On HTTP 404: throws "Figma file not found: {fileId}"
- [ ] PAT is NEVER logged, NEVER included in error messages, NEVER echoed to stdout
- [ ] Returns the same `RawFigmaVariables` shape as the MCP client
- [ ] Timeout: 30 seconds per request

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| Valid PAT + valid fileId | Returns `RawFigmaVariables` |
| Invalid PAT (403) | Throws PAT-specific error message (without PAT value) |
| Invalid fileId (404) | Throws file-not-found error |
| Rate limited (429) | Retries 3x with backoff, then throws if still 429 |
| Network offline | Throws connection error, allows fallback |
| PAT in error output | NEVER — verify PAT is not in any thrown error or console output |

### Notes

- Use `node:fetch` (Node 18+) — no external HTTP library needed
- PAT source priority: `FIGMA_PAT` env var → `.env` file → `.pixelproofrc` `figma.personalAccessToken` field. First found wins.
- Log the request URL (without auth header) at debug level for troubleshooting

---

## E2-S3: Fetch Layer Orchestrator

### Description

Implement the three-tier fetch hierarchy. Try MCP first, fall back to REST API, fall back to local tokens. Same output regardless of source.

### Files to Create

```
src/tokens/
  fetcher.ts         # fetchTokens(config) → { tokenMap: TokenMap, source: string }
```

### Acceptance Criteria

- [ ] **Tier 1 — MCP:** Calls `fetchViaFigmaMCP()`. If it returns data, use it. Log: `"Tokens fetched via Figma MCP"`
- [ ] **Tier 2 — REST API:** If MCP returns `null` AND `figma.personalAccessToken` is configured (or `FIGMA_PAT` env var exists), calls `fetchViaFigmaREST()`. Log: `"Tokens fetched via Figma REST API"`
- [ ] **Tier 3 — Local:** If both MCP and REST fail/unavailable, falls back to local `tokens/` directory (E1-S5 `loadLocalTokens()`). Log: `"Using local token files from tokens/"`
- [ ] **All fail:** If no source returns data, throws: `"No token source available. Provide Figma MCP, a Figma PAT, or local token files in tokens/"`
- [ ] Returns `{ tokenMap: TokenMap, source: 'mcp' | 'rest-api' | 'local' }`
- [ ] MCP failure does NOT log an error — only a debug-level warning. Falling back is normal.
- [ ] REST API failure (auth error, network error) logs a warning with the specific reason
- [ ] Integrates with cache: if cache is fresh (`isCacheFresh()` from E1-S5), skips fetch entirely and returns cached `TokenMap`. Log: `"Using cached tokens (synced {time} ago)"`

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| MCP available | Uses MCP, returns `source: 'mcp'` |
| MCP unavailable, PAT configured | Falls back to REST API, returns `source: 'rest-api'` |
| MCP unavailable, no PAT, local tokens exist | Falls back to local, returns `source: 'local'` |
| All three unavailable | Throws descriptive error |
| Cache is fresh (within TTL) | Returns cached TokenMap, no fetch attempted |
| Cache is stale | Fetches from highest available tier |
| `npx pixelproof sync --force` | Bypasses cache freshness check, always fetches |

---

## E2-S4: Figma Variable → Internal Token Format Converter

### Description

Transform raw Figma variable data (from MCP or REST API) into the internal `TokenMap` format. This is distinct from the DTCG/SD/TS converters in E1 — Figma's variable data has its own structure.

### Files to Create

```
src/tokens/converters/
  figma.ts           # convertFigmaVariables(raw: RawFigmaVariables) → TokenMap
```

### Acceptance Criteria

- [ ] Converts Figma variable collections → flat token entries keyed by path (e.g., `colors/brand/primary`)
- [ ] Resolves Figma variable aliases using the alias resolver from E1-S3 (same `resolveAliasChain()` function)
- [ ] Maps Figma variable types to internal types: `COLOR` → `color`, `FLOAT` → `spacing` (contextual — see notes), `STRING` → `typography` (contextual)
- [ ] Builds `lookupByValue` and `lookupByCssVar` maps (same structure as DTCG converter output)
- [ ] Handles multi-mode variables: uses the mode matching `render.theme` config (`light`/`dark`). Default: first mode.
- [ ] Normalizes hex values: `#FFF` → `#ffffff`, RGBA → hex when alpha = 1
- [ ] Produces identical `TokenMap` structure to DTCG converter — downstream consumers cannot tell the difference

### Test Cases

| Input | Expected Output |
|---|---|
| Figma variable `colors/brand/primary` with value `#0050C0` | `lookupByValue["#0050c0"]` includes `"colors/brand/primary"` |
| Figma alias: `colors/primary` → `colors/blue/600` → `#0050C0` | Both tokens resolve to `#0050c0`, both in `lookupByValue` |
| Variable with `light` mode = `#fff`, `dark` mode = `#000`, theme = `light` | Uses `#ffffff` |
| Variable type `COLOR` | Internal type = `color` |
| Variable with RGBA `rgba(0, 80, 192, 1)` | Normalized to `#0050c0` |

### Notes

- Figma's variable type mapping is contextual — a `FLOAT` variable named `spacing/4` should map to `spacing`, while `border-radius/md` should map to `border-radius`. Use the variable collection name or path prefix as a hint.
- If type inference is ambiguous, default to the Figma variable's `resolvedType` field.

---

## E2-S5: Cache TTL + Invalidation

### Description

Implement cache freshness checks and invalidation logic. The `sync` CLI command should respect TTL and support force refresh.

### Files to Modify

```
src/tokens/cache.ts      # Add isCacheFresh(), enhance writeCache()
src/cli/index.ts         # Wire `sync` command with --force flag
```

### Acceptance Criteria

- [ ] `isCacheFresh(syncTTL)` reads `syncedAt` from `token-cache.json`, compares against current time + configured `figma.syncTTL` (default 86400s = 24h)
- [ ] `npx pixelproof sync` fetches tokens only if cache is stale or missing
- [ ] `npx pixelproof sync --force` always fetches regardless of cache freshness
- [ ] `npx pixelproof start` checks cache freshness at startup — syncs if stale, uses cache if fresh
- [ ] After successful fetch: writes new `token-cache.json` with updated `syncedAt`
- [ ] Prints sync result: `"Token sync complete: {N} tokens from {source} (cached at {timestamp})"`
- [ ] Failed sync with existing cache: warns but continues with stale cache. `"Figma sync failed — using cached tokens from {syncedAt}"`
- [ ] Failed sync with NO existing cache: falls through to local tokens (tier 3)

### Test Cases

| Scenario | Expected Behavior |
|---|---|
| Cache written 2h ago, TTL=86400 | `isCacheFresh()` → true, skip fetch |
| Cache written 25h ago, TTL=86400 | `isCacheFresh()` → false, fetch triggered |
| No cache file exists | Fetch triggered |
| `sync --force` with fresh cache | Fetch triggered anyway |
| Fetch fails, stale cache exists | Warning logged, stale cache used |
| Fetch fails, no cache, local tokens exist | Falls back to local tokens |

---

## E2 Dependency Graph

```
E2-S1 (MCP client)  ──┐
                       ├──→ E2-S3 (Fetch orchestrator) ──→ E2-S5 (Cache TTL + CLI wiring)
E2-S2 (REST client) ──┘         │
                                 ↓
                          E2-S4 (Figma converter)
```

**E2 is complete when:** `npx pixelproof sync` fetches tokens from Figma (MCP or REST), resolves aliases, caches to `token-cache.json`, and `npx pixelproof start` uses cached tokens when fresh. Local fallback from E1 still works when Figma is unavailable.
