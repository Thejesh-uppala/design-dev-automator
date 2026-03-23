import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCache, writeCache, isCacheFresh } from '../cache.js';
import type { TokenMap } from '../types.js';

function createTestTokenMap(overrides: Partial<TokenMap> = {}): TokenMap {
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

describe('Cache', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'pixelproof-cache-test-'));
  });

  it('writeCache + readCache round-trip preserves data', () => {
    const tokenMap = createTestTokenMap();
    writeCache(cacheDir, tokenMap);

    const result = readCache(cacheDir);
    expect(result).not.toBeNull();
    expect(result!.tokens['colors/primary'].resolvedValue).toBe('#0050c0');
    expect(result!.lookupByValue['#0050c0']).toContain('colors/primary');
    expect(result!.lookupByCssVar['--colors-primary']).toBe('colors/primary');
    expect(result!.version).toBe('1');
    expect(result!.source).toBe('test');
  });

  it('readCache returns null for missing cache file', () => {
    const result = readCache(cacheDir);
    expect(result).toBeNull();
  });

  it('writeCache creates directory if it does not exist', () => {
    const nestedDir = join(cacheDir, 'nested', 'cache');
    const tokenMap = createTestTokenMap();

    writeCache(nestedDir, tokenMap);

    expect(existsSync(nestedDir)).toBe(true);
    const result = readCache(nestedDir);
    expect(result).not.toBeNull();
  });

  it('isCacheFresh returns true when within TTL', () => {
    const tokenMap = createTestTokenMap({
      syncedAt: new Date().toISOString(), // just now
    });
    expect(isCacheFresh(tokenMap, 86400)).toBe(true);
  });

  it('isCacheFresh returns false when expired', () => {
    const expired = new Date(Date.now() - 90000 * 1000); // 25 hours ago
    const tokenMap = createTestTokenMap({
      syncedAt: expired.toISOString(),
    });
    expect(isCacheFresh(tokenMap, 86400)).toBe(false);
  });

  it('isCacheFresh returns false for invalid syncedAt', () => {
    const tokenMap = createTestTokenMap({
      syncedAt: 'not-a-date',
    });
    expect(isCacheFresh(tokenMap, 86400)).toBe(false);
  });
});
