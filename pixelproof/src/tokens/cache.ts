import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TokenMap } from './types.js';

const CACHE_FILENAME = 'token-cache.json';

/**
 * Read cached token map from disk.
 * Returns null if the cache file doesn't exist.
 */
export function readCache(cacheDir: string): TokenMap | null {
  const cachePath = join(cacheDir, CACHE_FILENAME);

  if (!existsSync(cachePath)) {
    return null;
  }

  const content = readFileSync(cachePath, 'utf-8');
  return JSON.parse(content) as TokenMap;
}

/**
 * Write token map to cache file.
 * Creates the cache directory if it doesn't exist.
 */
export function writeCache(cacheDir: string, tokenMap: TokenMap): void {
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  const cachePath = join(cacheDir, CACHE_FILENAME);
  writeFileSync(cachePath, JSON.stringify(tokenMap, null, 2), 'utf-8');
}

/**
 * Check if a cached token map is still fresh based on syncTTL (in seconds).
 * Returns true if the cache age is less than syncTTL.
 */
export function isCacheFresh(tokenMap: TokenMap, syncTTL: number): boolean {
  const syncedAt = Date.parse(tokenMap.syncedAt);
  if (isNaN(syncedAt)) return false;
  return (Date.now() - syncedAt) < syncTTL * 1000;
}
