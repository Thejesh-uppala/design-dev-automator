import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockScreenshot = vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50]));
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockWaitForSelector = vi.fn().mockResolvedValue(null);
const mockGoto = vi.fn().mockResolvedValue(undefined);
const mockSetViewportSize = vi.fn().mockResolvedValue(undefined);
const mockPageClose = vi.fn().mockResolvedValue(undefined);
const mockElementQuery = vi.fn();

const mockPage = {
  setViewportSize: mockSetViewportSize,
  goto: mockGoto,
  waitForSelector: mockWaitForSelector,
  $: mockElementQuery,
  close: mockPageClose,
};

const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: mockClose,
};

vi.mock('playwright-core', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

import { PlaywrightRunner } from '../playwright-runner.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockBrowser.newPage.mockResolvedValue(mockPage);
  // Default: no error element, root element exists with screenshot
  mockElementQuery.mockImplementation((selector: string) => {
    if (selector === '#pixelproof-error') return Promise.resolve(null);
    if (selector === '#pixelproof-root')
      return Promise.resolve({ screenshot: mockScreenshot });
    return Promise.resolve(null);
  });
  mockWaitForSelector.mockResolvedValue(null);
});

describe('PlaywrightRunner', () => {
  it('launches Chromium headless', async () => {
    const runner = new PlaywrightRunner();
    await runner.launch();

    const pw = await import('playwright-core');
    expect(pw.chromium.launch).toHaveBeenCalledWith({ headless: true });

    await runner.close();
  });

  it('captures screenshot of rendered component', async () => {
    const runner = new PlaywrightRunner();
    await runner.launch();

    const result = await runner.captureScreenshot(
      'src/components/Button.tsx',
      'Button',
      { width: 1440, height: 900 },
      3001,
      '/tmp/screenshots/Button.png',
    );

    expect(result.success).toBe(true);
    expect(result.path).toBe('/tmp/screenshots/Button.png');
    expect(mockSetViewportSize).toHaveBeenCalledWith({
      width: 1440,
      height: 900,
    });
    expect(mockGoto).toHaveBeenCalledWith(
      expect.stringContaining('localhost:3001/harness'),
      expect.any(Object),
    );
    expect(mockScreenshot).toHaveBeenCalledWith({
      path: '/tmp/screenshots/Button.png',
    });

    await runner.close();
  });

  it('returns error when browser not launched', async () => {
    const runner = new PlaywrightRunner();

    const result = await runner.captureScreenshot(
      'src/Button.tsx',
      'Button',
      { width: 1440, height: 900 },
      3001,
      '/tmp/Button.png',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not launched');
  });

  it('returns error on waitForSelector timeout', async () => {
    mockWaitForSelector.mockRejectedValue(new Error('Timeout'));

    const runner = new PlaywrightRunner();
    await runner.launch();

    const result = await runner.captureScreenshot(
      'src/Button.tsx',
      'Button',
      { width: 1440, height: 900 },
      3001,
      '/tmp/Button.png',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');

    await runner.close();
  });

  it('returns error when ErrorBoundary triggered', async () => {
    mockElementQuery.mockImplementation((selector: string) => {
      if (selector === '#pixelproof-error')
        return Promise.resolve({ textContent: 'Error!' });
      if (selector === '#pixelproof-root')
        return Promise.resolve({ screenshot: mockScreenshot });
      return Promise.resolve(null);
    });

    const runner = new PlaywrightRunner();
    await runner.launch();

    const result = await runner.captureScreenshot(
      'src/Button.tsx',
      'Button',
      { width: 1440, height: 900 },
      3001,
      '/tmp/Button.png',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('ErrorBoundary');

    await runner.close();
  });

  it('returns error when #pixelproof-root not found', async () => {
    mockElementQuery.mockImplementation((selector: string) => {
      if (selector === '#pixelproof-error') return Promise.resolve(null);
      if (selector === '#pixelproof-root') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const runner = new PlaywrightRunner();
    await runner.launch();

    const result = await runner.captureScreenshot(
      'src/Button.tsx',
      'Button',
      { width: 1440, height: 900 },
      3001,
      '/tmp/Button.png',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('#pixelproof-root');

    await runner.close();
  });

  it('reuses browser instance across multiple screenshots', async () => {
    const runner = new PlaywrightRunner();
    await runner.launch();

    await runner.captureScreenshot(
      'src/Button.tsx',
      'Button',
      { width: 1440, height: 900 },
      3001,
      '/tmp/Button.png',
    );
    await runner.captureScreenshot(
      'src/Card.tsx',
      'Card',
      { width: 1440, height: 900 },
      3001,
      '/tmp/Card.png',
    );

    const pw = await import('playwright-core');
    expect(pw.chromium.launch).toHaveBeenCalledTimes(1);
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);

    await runner.close();
  });

  it('closes browser cleanly', async () => {
    const runner = new PlaywrightRunner();
    await runner.launch();
    await runner.close();

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('close() is safe to call without launch', async () => {
    const runner = new PlaywrightRunner();
    await runner.close();
    expect(mockClose).not.toHaveBeenCalled();
  });
});
