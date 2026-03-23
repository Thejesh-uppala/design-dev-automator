import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PixelProofConfig } from '../../config/schema.js';
import { ScoreStore } from '../../scoring/store.js';

// Mock all sub-modules
vi.mock('../playwright-setup.js', () => ({
  isChromiumInstalled: vi.fn().mockResolvedValue(true),
}));

vi.mock('../figma-images.js', () => ({
  fetchReferenceImages: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('../pixel-diff.js', () => ({
  diffImages: vi.fn().mockReturnValue({
    totalPixels: 1000,
    differentPixels: 100,
    matchPercentage: 90.0,
    diffImagePath: '/tmp/diff.png',
  }),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    mkdirSync: vi.fn(),
  };
});

// Mock PlaywrightRunner as a class
const mockCaptureScreenshot = vi.fn().mockResolvedValue({
  path: '/tmp/screenshot.png',
  success: true,
});
const mockRunnerClose = vi.fn().mockResolvedValue(undefined);
const mockRunnerLaunch = vi.fn().mockResolvedValue(undefined);

vi.mock('../playwright-runner.js', () => ({
  PlaywrightRunner: class MockPlaywrightRunner {
    launch = mockRunnerLaunch;
    captureScreenshot = mockCaptureScreenshot;
    close = mockRunnerClose;
  },
}));

import { renderPipeline, deriveComponentName } from '../pipeline.js';
import { isChromiumInstalled } from '../playwright-setup.js';
import { fetchReferenceImages } from '../figma-images.js';
import { diffImages } from '../pixel-diff.js';

function makeConfig(
  overrides: Partial<PixelProofConfig> = {},
): PixelProofConfig {
  return {
    figma: {
      fileId: 'test-file',
      personalAccessToken: 'test-pat',
      syncTTL: 3600000,
      nodeIds: {},
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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isChromiumInstalled).mockResolvedValue(true);
  mockCaptureScreenshot.mockResolvedValue({
    path: '/tmp/screenshot.png',
    success: true,
  });
});

describe('renderPipeline', () => {
  it('skips all when render.enabled is false', async () => {
    const store = new ScoreStore();
    store.setViolations('src/Button.tsx', [], 10);
    store.setViolations('src/Card.tsx', [], 5);

    const config = makeConfig({
      render: {
        enabled: false,
        viewport: { width: 1440, height: 900 },
        tolerance: 4,
        theme: 'light',
      },
    });

    const result = await renderPipeline(config, store, '/root', 3001);

    expect(result.rendered).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.errors).toBe(0);
    expect(store.getComponentScore('src/Button.tsx')!.renderStatus).toBe(
      'skipped',
    );
  });

  it('skips all when Chromium not installed', async () => {
    vi.mocked(isChromiumInstalled).mockResolvedValue(false);

    const store = new ScoreStore();
    store.setViolations('src/Button.tsx', [], 10);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = makeConfig();
    const result = await renderPipeline(config, store, '/root', 3001);

    expect(result.rendered).toBe(0);
    expect(result.skipped).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Chromium not found'),
    );
    warnSpy.mockRestore();
  });

  it('renders mapped components and skips unmapped', async () => {
    const store = new ScoreStore();
    store.setViolations('src/Button.tsx', [], 10);
    store.setViolations('src/Card.tsx', [], 5);
    store.setViolations('src/Utils.ts', [], 3);

    const baselines = new Map([
      ['Button', '/baselines/Button.png'],
      ['Card', '/baselines/Card.png'],
    ]);
    vi.mocked(fetchReferenceImages).mockResolvedValue(baselines);

    const config = makeConfig({
      figma: {
        fileId: 'test-file',
        personalAccessToken: 'test-pat',
        syncTTL: 3600000,
        nodeIds: { Button: '123:456', Card: '123:789' },
      },
    });

    const result = await renderPipeline(config, store, '/root', 3001);

    expect(result.rendered).toBe(2);
    expect(result.skipped).toBe(1); // Utils.ts not in nodeIds
    expect(result.errors).toBe(0);

    expect(store.getComponentScore('src/Button.tsx')!.renderStatus).toBe(
      'rendered',
    );
    expect(store.getComponentScore('src/Card.tsx')!.renderStatus).toBe(
      'rendered',
    );
    expect(store.getComponentScore('src/Utils.ts')!.renderStatus).toBe(
      'skipped',
    );
  });

  it('handles screenshot failure as error', async () => {
    const store = new ScoreStore();
    store.setViolations('src/Button.tsx', [], 10);

    const baselines = new Map([['Button', '/baselines/Button.png']]);
    vi.mocked(fetchReferenceImages).mockResolvedValue(baselines);

    mockCaptureScreenshot.mockResolvedValue({
      path: '/tmp/screenshot.png',
      success: false,
      error: 'Timeout',
    });

    const config = makeConfig({
      figma: {
        fileId: 'test-file',
        personalAccessToken: 'test-pat',
        syncTTL: 3600000,
        nodeIds: { Button: '123:456' },
      },
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await renderPipeline(config, store, '/root', 3001);

    expect(result.rendered).toBe(0);
    expect(result.errors).toBe(1);
    expect(store.getComponentScore('src/Button.tsx')!.renderStatus).toBe(
      'error',
    );
    warnSpy.mockRestore();
  });

  it('skips component when baseline image is missing', async () => {
    const store = new ScoreStore();
    store.setViolations('src/Button.tsx', [], 10);

    // Return empty baselines (fetch failed or nodeId not found)
    vi.mocked(fetchReferenceImages).mockResolvedValue(new Map());

    const config = makeConfig({
      figma: {
        fileId: 'test-file',
        personalAccessToken: 'test-pat',
        syncTTL: 3600000,
        nodeIds: { Button: '123:456' },
      },
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await renderPipeline(config, store, '/root', 3001);

    expect(result.rendered).toBe(0);
    expect(result.skipped).toBe(1);
    warnSpy.mockRestore();
  });

  it('calculates correct render fidelity score', async () => {
    const store = new ScoreStore();
    store.setViolations('src/Button.tsx', [], 10);

    const baselines = new Map([['Button', '/baselines/Button.png']]);
    vi.mocked(fetchReferenceImages).mockResolvedValue(baselines);
    vi.mocked(diffImages).mockReturnValue({
      totalPixels: 1_000_000,
      differentPixels: 50_000,
      matchPercentage: 95.0,
      diffImagePath: '/tmp/diff.png',
    });

    const config = makeConfig({
      figma: {
        fileId: 'test-file',
        personalAccessToken: 'test-pat',
        syncTTL: 3600000,
        nodeIds: { Button: '123:456' },
      },
    });

    await renderPipeline(config, store, '/root', 3001);

    const score = store.getComponentScore('src/Button.tsx')!;
    expect(score.renderFidelity).toBe(95.0);
    expect(score.renderStatus).toBe('rendered');
  });

  it('closes browser even on error', async () => {
    const store = new ScoreStore();
    store.setViolations('src/Button.tsx', [], 10);

    const baselines = new Map([['Button', '/baselines/Button.png']]);
    vi.mocked(fetchReferenceImages).mockResolvedValue(baselines);

    // Make diffImages throw
    vi.mocked(diffImages).mockImplementation(() => {
      throw new Error('PNG decode failed');
    });

    const config = makeConfig({
      figma: {
        fileId: 'test-file',
        personalAccessToken: 'test-pat',
        syncTTL: 3600000,
        nodeIds: { Button: '123:456' },
      },
    });

    await expect(
      renderPipeline(config, store, '/root', 3001),
    ).rejects.toThrow('PNG decode failed');

    // Browser should still be closed via finally block
    expect(mockRunnerClose).toHaveBeenCalled();
  });
});

describe('deriveComponentName', () => {
  it('extracts name from .tsx file', () => {
    expect(deriveComponentName('src/components/Button.tsx')).toBe('Button');
  });

  it('extracts name from .ts file', () => {
    expect(deriveComponentName('src/utils/helpers.ts')).toBe('helpers');
  });

  it('extracts name from .jsx file', () => {
    expect(deriveComponentName('src/Card.jsx')).toBe('Card');
  });

  it('handles nested paths', () => {
    expect(
      deriveComponentName('src/components/ui/forms/Input.tsx'),
    ).toBe('Input');
  });
});
