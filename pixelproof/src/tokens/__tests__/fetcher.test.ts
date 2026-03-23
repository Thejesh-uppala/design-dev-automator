import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PixelProofConfig } from '../../config/schema.js';
import type { TokenMap } from '../types.js';
import { writeCache } from '../cache.js';

// Mock the MCP and REST clients
vi.mock('../figma-mcp.js', () => ({
  fetchViaFigmaMCP: vi.fn().mockResolvedValue(null),
}));

vi.mock('../figma-rest.js', () => ({
  fetchViaFigmaREST: vi.fn(),
  resolvePAT: vi.fn().mockReturnValue(null),
}));

vi.mock('../converters/figma.js', () => ({
  convertFigmaVariables: vi.fn(),
}));

function createTestConfig(
  overrides: Partial<PixelProofConfig> = {},
): PixelProofConfig {
  return {
    scan: {
      include: ['src/**'],
      exclude: ['**/*.test.tsx'],
      fileTypes: ['tsx', 'ts'],
    },
    tokens: {
      format: 'dtcg',
      fallbackDir: 'tokens/',
    },
    dashboard: { port: 3001 },
    render: {
      enabled: true,
      viewport: { width: 1440, height: 900 },
      tolerance: 4,
      theme: 'light',
    },
    ...overrides,
  };
}

function createTestTokenMap(
  overrides: Partial<TokenMap> = {},
): TokenMap {
  return {
    version: '1',
    syncedAt: new Date().toISOString(),
    source: 'test',
    tokens: {
      'colors/primary': {
        resolvedValue: '#0050c0',
        aliasChain: ['colors/primary'],
        cssVar: '--colors-primary',
        type: 'color',
      },
    },
    lookupByValue: { '#0050c0': ['colors/primary'] },
    lookupByCssVar: { '--colors-primary': 'colors/primary' },
    ...overrides,
  };
}

describe('Fetch Layer Orchestrator', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'pixelproof-fetcher-test-'));
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached tokens when cache is fresh', async () => {
    const freshTokenMap = createTestTokenMap({
      syncedAt: new Date().toISOString(),
    });
    const cacheDir = join(rootDir, '.pixelproof');
    mkdirSync(cacheDir, { recursive: true });
    writeCache(cacheDir, freshTokenMap);

    const { fetchTokens } = await import('../fetcher.js');
    const config = createTestConfig({
      figma: { fileId: 'abc', personalAccessToken: 'pat', syncTTL: 86400 },
    });

    const result = await fetchTokens(config, rootDir);

    expect(result.source).toBe('cache');
    expect(result.tokenMap.tokens['colors/primary']).toBeDefined();
  });

  it('bypasses cache when force is true', async () => {
    const freshTokenMap = createTestTokenMap({
      syncedAt: new Date().toISOString(),
    });
    const cacheDir = join(rootDir, '.pixelproof');
    mkdirSync(cacheDir, { recursive: true });
    writeCache(cacheDir, freshTokenMap);

    // MCP returns null, no PAT → should fall to local
    const { fetchTokens } = await import('../fetcher.js');
    const config = createTestConfig();

    // Create local tokens
    const tokensDir = join(rootDir, 'tokens');
    mkdirSync(tokensDir, { recursive: true });
    writeFileSync(
      join(tokensDir, 'colors.json'),
      JSON.stringify({
        colors: {
          primary: {
            $value: '#ff0000',
            $type: 'color',
          },
        },
      }),
      'utf-8',
    );

    const result = await fetchTokens(config, rootDir, { force: true });

    // Should NOT use cache — should fetch from local
    expect(result.source).toBe('local');
  });

  it('uses MCP when available (tier 1)', async () => {
    const mcpResult = {
      variables: { 'var:1': { id: 'var:1', name: 'test', resolvedType: 'COLOR', variableCollectionId: 'c:1', valuesByMode: { 'm:1': { r: 1, g: 0, b: 0, a: 1 } } } },
      collections: { 'c:1': { id: 'c:1', name: 'C', modes: [{ modeId: 'm:1', name: 'Light' }] } },
    };
    const convertedMap = createTestTokenMap({ source: 'mcp' });

    const { fetchViaFigmaMCP } = await import('../figma-mcp.js');
    const { convertFigmaVariables } = await import('../converters/figma.js');
    vi.mocked(fetchViaFigmaMCP).mockResolvedValueOnce(mcpResult);
    vi.mocked(convertFigmaVariables).mockReturnValueOnce(convertedMap);

    const { fetchTokens } = await import('../fetcher.js');
    const config = createTestConfig({
      figma: { fileId: 'abc', personalAccessToken: 'pat', syncTTL: 86400 },
    });

    const result = await fetchTokens(config, rootDir, { force: true });

    expect(result.source).toBe('mcp');
  });

  it('falls back to REST when MCP is unavailable (tier 2)', async () => {
    const restResult = {
      variables: { 'var:1': { id: 'var:1', name: 'test', resolvedType: 'COLOR', variableCollectionId: 'c:1', valuesByMode: { 'm:1': { r: 1, g: 0, b: 0, a: 1 } } } },
      collections: { 'c:1': { id: 'c:1', name: 'C', modes: [{ modeId: 'm:1', name: 'Light' }] } },
    };
    const convertedMap = createTestTokenMap({ source: 'rest-api' });

    const { fetchViaFigmaMCP } = await import('../figma-mcp.js');
    const { fetchViaFigmaREST, resolvePAT } = await import('../figma-rest.js');
    const { convertFigmaVariables } = await import('../converters/figma.js');
    vi.mocked(fetchViaFigmaMCP).mockResolvedValueOnce(null);
    vi.mocked(resolvePAT).mockReturnValueOnce('test-pat');
    vi.mocked(fetchViaFigmaREST).mockResolvedValueOnce(restResult);
    vi.mocked(convertFigmaVariables).mockReturnValueOnce(convertedMap);

    const { fetchTokens } = await import('../fetcher.js');
    const config = createTestConfig({
      figma: { fileId: 'abc', personalAccessToken: 'pat', syncTTL: 86400 },
    });

    const result = await fetchTokens(config, rootDir, { force: true });

    expect(result.source).toBe('rest-api');
  });

  it('falls back to local tokens when MCP and REST unavailable (tier 3)', async () => {
    const { fetchViaFigmaMCP } = await import('../figma-mcp.js');
    const { resolvePAT } = await import('../figma-rest.js');
    vi.mocked(fetchViaFigmaMCP).mockResolvedValueOnce(null);
    vi.mocked(resolvePAT).mockReturnValueOnce(null);

    // Create local tokens
    const tokensDir = join(rootDir, 'tokens');
    mkdirSync(tokensDir, { recursive: true });
    writeFileSync(
      join(tokensDir, 'colors.json'),
      JSON.stringify({
        colors: {
          primary: {
            $value: '#ff0000',
            $type: 'color',
          },
        },
      }),
      'utf-8',
    );

    const { fetchTokens } = await import('../fetcher.js');
    const config = createTestConfig();

    const result = await fetchTokens(config, rootDir, { force: true });

    expect(result.source).toBe('local');
  });

  it('throws when all sources unavailable', async () => {
    const { fetchViaFigmaMCP } = await import('../figma-mcp.js');
    const { resolvePAT } = await import('../figma-rest.js');
    vi.mocked(fetchViaFigmaMCP).mockResolvedValueOnce(null);
    vi.mocked(resolvePAT).mockReturnValueOnce(null);

    const { fetchTokens } = await import('../fetcher.js');
    const config = createTestConfig();

    await expect(fetchTokens(config, rootDir, { force: true })).rejects.toThrow(
      'No token source available',
    );
  });

  it('uses stale cache when REST fails but cache exists', async () => {
    // Write stale cache
    const staleTokenMap = createTestTokenMap({
      syncedAt: new Date(Date.now() - 200_000 * 1000).toISOString(),
      source: 'rest-api',
    });
    const cacheDir = join(rootDir, '.pixelproof');
    mkdirSync(cacheDir, { recursive: true });
    writeCache(cacheDir, staleTokenMap);

    const { fetchViaFigmaMCP } = await import('../figma-mcp.js');
    const { fetchViaFigmaREST, resolvePAT } = await import('../figma-rest.js');
    vi.mocked(fetchViaFigmaMCP).mockResolvedValueOnce(null);
    vi.mocked(resolvePAT).mockReturnValueOnce('test-pat');
    vi.mocked(fetchViaFigmaREST).mockRejectedValueOnce(
      new Error('Network error'),
    );

    const { fetchTokens } = await import('../fetcher.js');
    const config = createTestConfig({
      figma: { fileId: 'abc', personalAccessToken: 'pat', syncTTL: 86400 },
    });

    const result = await fetchTokens(config, rootDir, { force: true });

    expect(result.source).toBe('cache');
  });

  it('returns stale cache when cache is expired and no fetch sources', async () => {
    // Write stale cache
    const staleTokenMap = createTestTokenMap({
      syncedAt: new Date(Date.now() - 200_000 * 1000).toISOString(),
    });
    const cacheDir = join(rootDir, '.pixelproof');
    mkdirSync(cacheDir, { recursive: true });
    writeCache(cacheDir, staleTokenMap);

    const { fetchViaFigmaMCP } = await import('../figma-mcp.js');
    const { resolvePAT } = await import('../figma-rest.js');
    vi.mocked(fetchViaFigmaMCP).mockResolvedValueOnce(null);
    vi.mocked(resolvePAT).mockReturnValueOnce(null);

    const { fetchTokens } = await import('../fetcher.js');
    const config = createTestConfig();

    // No local tokens, so should fall back to stale cache
    const result = await fetchTokens(config, rootDir);

    expect(result.source).toBe('cache');
  });
});
