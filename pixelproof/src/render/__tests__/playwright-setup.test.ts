import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecutablePath = vi.fn();
const mockExistsSync = vi.fn();
const mockExecSync = vi.fn();

// Mock node:fs
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
  };
});

// Mock playwright-core
vi.mock('playwright-core', () => ({
  chromium: {
    executablePath: (...args: unknown[]) => mockExecutablePath(...args),
  },
}));

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

import { isChromiumInstalled, installChromium } from '../playwright-setup.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isChromiumInstalled', () => {
  it('returns true when Chromium binary exists', async () => {
    mockExecutablePath.mockReturnValue('/path/to/chromium');
    mockExistsSync.mockReturnValue(true);

    expect(await isChromiumInstalled()).toBe(true);
  });

  it('returns false when Chromium binary does not exist', async () => {
    mockExecutablePath.mockReturnValue('/path/to/chromium');
    mockExistsSync.mockReturnValue(false);

    expect(await isChromiumInstalled()).toBe(false);
  });

  it('returns false when playwright-core throws', async () => {
    mockExecutablePath.mockImplementation(() => {
      throw new Error('Not installed');
    });

    expect(await isChromiumInstalled()).toBe(false);
  });
});

describe('installChromium', () => {
  it('prints already installed when binary exists', async () => {
    mockExecutablePath.mockReturnValue('/path/to/chromium');
    mockExistsSync.mockReturnValue(true);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await installChromium();

    expect(logSpy).toHaveBeenCalledWith('Chromium already installed.');
    logSpy.mockRestore();
  });

  it('runs install command when binary does not exist', async () => {
    mockExecutablePath.mockReturnValue('/path/to/chromium');
    mockExistsSync.mockReturnValue(false);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await installChromium();

    expect(logSpy).toHaveBeenCalledWith('Downloading Chromium...');
    expect(logSpy).toHaveBeenCalledWith('Chromium installed successfully.');
    expect(mockExecSync).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('runs install when executablePath throws', async () => {
    mockExecutablePath.mockImplementation(() => {
      throw new Error('Not found');
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await installChromium();

    expect(logSpy).toHaveBeenCalledWith('Downloading Chromium...');
    expect(mockExecSync).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
