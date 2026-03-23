import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { PixelProofConfig } from '../../config/schema.js';
import { fetchReferenceImages, fetchImageUrls } from '../figma-images.js';

const TEST_DIR = resolve(tmpdir(), 'pixelproof-figma-img-' + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        images: {
          '123:456': 'https://figma.test/img/button.png',
          '123:789': 'https://figma.test/img/card.png',
        },
      }),
      arrayBuffer: async () => new ArrayBuffer(8),
    }),
  );
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function makeConfig(
  nodeIds: Record<string, string> = {},
): PixelProofConfig {
  return {
    figma: {
      fileId: 'test-file-id',
      personalAccessToken: 'test-pat',
      syncTTL: 3600000,
      nodeIds,
    },
    scan: { include: ['src/**'], exclude: [], fileTypes: ['tsx'] },
    tokens: { format: 'dtcg', fallbackDir: 'tokens/' },
    dashboard: { port: 3001 },
    render: {
      enabled: true,
      viewport: { width: 1440, height: 900 },
      tolerance: 4,
      theme: 'light',
    },
  };
}

describe('fetchReferenceImages', () => {
  it('returns empty map when no nodeIds configured', async () => {
    const config = makeConfig();
    const result = await fetchReferenceImages(config, TEST_DIR);
    expect(result.size).toBe(0);
  });

  it('fetches images for mapped components', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    // Override fetch to handle both API call and image download
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.figma.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            images: {
              '123:456': 'https://figma.test/img/button.png',
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: async () => pngBytes.buffer,
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const config = makeConfig({ Button: '123:456' });
    const result = await fetchReferenceImages(config, TEST_DIR);

    expect(result.size).toBe(1);
    expect(result.has('Button')).toBe(true);
    expect(
      existsSync(resolve(TEST_DIR, '.pixelproof', 'baselines', 'Button.png')),
    ).toBe(true);
  });

  it('skips fetch when baseline already exists (cached)', async () => {
    // Pre-create baseline
    const baselinesDir = resolve(TEST_DIR, '.pixelproof', 'baselines');
    mkdirSync(baselinesDir, { recursive: true });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(
      resolve(baselinesDir, 'Button.png'),
      Buffer.from([0x89, 0x50]),
    );

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const config = makeConfig({ Button: '123:456' });
    const result = await fetchReferenceImages(config, TEST_DIR);

    expect(result.size).toBe(1);
    // Should NOT have called fetch since baseline exists
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('re-fetches when force is true', async () => {
    // Pre-create baseline
    const baselinesDir = resolve(TEST_DIR, '.pixelproof', 'baselines');
    mkdirSync(baselinesDir, { recursive: true });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(
      resolve(baselinesDir, 'Button.png'),
      Buffer.from([0x89, 0x50]),
    );

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.figma.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            images: { '123:456': 'https://figma.test/img/button.png' },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const config = makeConfig({ Button: '123:456' });
    const result = await fetchReferenceImages(config, TEST_DIR, {
      force: true,
    });

    expect(result.size).toBe(1);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('warns when nodeId not found in Figma response', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.figma.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ images: {} }), // No images returned
        });
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = makeConfig({ Button: '999:999' });
    const result = await fetchReferenceImages(config, TEST_DIR);

    expect(result.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('999:999 not found'),
    );
    warnSpy.mockRestore();
  });

  it('warns when no PAT available', async () => {
    const config: PixelProofConfig = {
      figma: {
        fileId: 'test-file',
        personalAccessToken: '',
        syncTTL: 3600000,
        nodeIds: { Button: '123:456' },
      },
      scan: { include: ['src/**'], exclude: [], fileTypes: ['tsx'] },
      tokens: { format: 'dtcg', fallbackDir: 'tokens/' },
      dashboard: { port: 3001 },
      render: {
        enabled: true,
        viewport: { width: 1440, height: 900 },
        tolerance: 4,
        theme: 'light',
      },
    };

    // Ensure FIGMA_PAT env var is not set
    const origPat = process.env.FIGMA_PAT;
    delete process.env.FIGMA_PAT;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await fetchReferenceImages(config, TEST_DIR);

    expect(result.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No Figma PAT'),
    );
    warnSpy.mockRestore();

    if (origPat) process.env.FIGMA_PAT = origPat;
  });
});

describe('fetchImageUrls', () => {
  it('batches node IDs into single API call', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        images: {
          '123:456': 'https://figma.test/img1.png',
          '123:789': 'https://figma.test/img2.png',
        },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchImageUrls(
      'file-id',
      ['123:456', '123:789'],
      'pat',
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result['123:456']).toBe('https://figma.test/img1.png');
    expect(result['123:789']).toBe('https://figma.test/img2.png');
  });

  it('throws on API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    await expect(
      fetchImageUrls('file-id', ['123:456'], 'pat'),
    ).rejects.toThrow('Figma Images API error');
  });

  it('filters out null image URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          images: { '123:456': 'https://figma.test/ok.png', '123:789': null },
        }),
      }),
    );

    const result = await fetchImageUrls(
      'file-id',
      ['123:456', '123:789'],
      'pat',
    );
    expect(result['123:456']).toBeDefined();
    expect(result['123:789']).toBeUndefined();
  });
});
