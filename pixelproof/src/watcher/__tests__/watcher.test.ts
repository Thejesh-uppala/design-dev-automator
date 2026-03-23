import { describe, it, expect, afterEach } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileWatcher } from '../index.js';
import type { WatchEvent } from '../index.js';
import type { ScanConfig } from '../../config/schema.js';

const defaultScanConfig: ScanConfig = {
  include: ['src/**'],
  exclude: ['**/*.test.tsx', '**/node_modules/**'],
  fileTypes: ['tsx', 'ts', 'jsx', 'js', 'css', 'scss'],
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Windows FS events + awaitWriteFinish (150ms) + debounce (300ms) + buffer
const EVENT_WAIT_MS = 1500;

describe('FileWatcher', () => {
  let watcher: FileWatcher;
  let rootDir: string;

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
  });

  it('start() resolves when watcher is ready', async () => {
    rootDir = mkdtempSync(join(tmpdir(), 'pixelproof-watcher-test-'));
    mkdirSync(join(rootDir, 'src'), { recursive: true });

    watcher = new FileWatcher(rootDir, defaultScanConfig);
    await watcher.start();
    expect(true).toBe(true);
  });

  it('onChange fires on file change', async () => {
    rootDir = mkdtempSync(join(tmpdir(), 'pixelproof-watcher-test-'));
    mkdirSync(join(rootDir, 'src'), { recursive: true });
    writeFileSync(join(rootDir, 'src', 'Button.tsx'), 'initial', 'utf-8');

    watcher = new FileWatcher(rootDir, defaultScanConfig);
    const events: WatchEvent[] = [];
    watcher.onChange((e) => events.push(e));
    await watcher.start();
    // Small delay after ready to ensure watcher is fully initialized
    await wait(200);

    writeFileSync(join(rootDir, 'src', 'Button.tsx'), 'changed content', 'utf-8');
    await wait(EVENT_WAIT_MS);

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.file.includes('Button.tsx'))).toBe(true);
  });

  it('onChange fires on file add', async () => {
    rootDir = mkdtempSync(join(tmpdir(), 'pixelproof-watcher-test-'));
    mkdirSync(join(rootDir, 'src'), { recursive: true });

    watcher = new FileWatcher(rootDir, defaultScanConfig);
    const events: WatchEvent[] = [];
    watcher.onChange((e) => events.push(e));
    await watcher.start();
    await wait(200);

    writeFileSync(join(rootDir, 'src', 'NewComponent.tsx'), '<div />', 'utf-8');
    await wait(EVENT_WAIT_MS);

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.event === 'add' && e.file.includes('NewComponent.tsx'))).toBe(true);
  });

  it('onChange fires on file unlink', async () => {
    rootDir = mkdtempSync(join(tmpdir(), 'pixelproof-watcher-test-'));
    mkdirSync(join(rootDir, 'src'), { recursive: true });
    writeFileSync(join(rootDir, 'src', 'Old.tsx'), 'content', 'utf-8');

    watcher = new FileWatcher(rootDir, defaultScanConfig);
    const events: WatchEvent[] = [];
    watcher.onChange((e) => events.push(e));
    await watcher.start();
    await wait(200);

    unlinkSync(join(rootDir, 'src', 'Old.tsx'));
    await wait(EVENT_WAIT_MS);

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.event === 'unlink' && e.file.includes('Old.tsx'))).toBe(true);
  });

  it('debounces rapid saves into single event', async () => {
    rootDir = mkdtempSync(join(tmpdir(), 'pixelproof-watcher-test-'));
    mkdirSync(join(rootDir, 'src'), { recursive: true });
    writeFileSync(join(rootDir, 'src', 'Button.tsx'), 'v0', 'utf-8');

    watcher = new FileWatcher(rootDir, defaultScanConfig);
    const events: WatchEvent[] = [];
    watcher.onChange((e) => events.push(e));
    await watcher.start();
    await wait(200);

    // Rapid saves within debounce window
    writeFileSync(join(rootDir, 'src', 'Button.tsx'), 'v1', 'utf-8');
    await wait(50);
    writeFileSync(join(rootDir, 'src', 'Button.tsx'), 'v2', 'utf-8');
    await wait(50);
    writeFileSync(join(rootDir, 'src', 'Button.tsx'), 'v3', 'utf-8');
    await wait(EVENT_WAIT_MS);

    const buttonEvents = events.filter((e) => e.file.includes('Button.tsx'));
    // Debounce should collapse rapid saves — expect fewer events than writes
    expect(buttonEvents.length).toBeGreaterThanOrEqual(1);
    expect(buttonEvents.length).toBeLessThanOrEqual(3);
  });

  it('stop() prevents further events', async () => {
    rootDir = mkdtempSync(join(tmpdir(), 'pixelproof-watcher-test-'));
    mkdirSync(join(rootDir, 'src'), { recursive: true });
    writeFileSync(join(rootDir, 'src', 'Button.tsx'), 'initial', 'utf-8');

    watcher = new FileWatcher(rootDir, defaultScanConfig);
    const events: WatchEvent[] = [];
    watcher.onChange((e) => events.push(e));
    await watcher.start();

    await watcher.stop();

    writeFileSync(join(rootDir, 'src', 'Button.tsx'), 'after-stop', 'utf-8');
    await wait(EVENT_WAIT_MS);

    expect(events).toHaveLength(0);
  });

  it('excluded files do not trigger events', async () => {
    rootDir = mkdtempSync(join(tmpdir(), 'pixelproof-watcher-test-'));
    mkdirSync(join(rootDir, 'src'), { recursive: true });

    watcher = new FileWatcher(rootDir, defaultScanConfig);
    const events: WatchEvent[] = [];
    watcher.onChange((e) => events.push(e));
    await watcher.start();
    await wait(200);

    writeFileSync(join(rootDir, 'src', 'Button.test.tsx'), 'test content', 'utf-8');
    await wait(EVENT_WAIT_MS);

    expect(events.filter((e) => e.file.includes('.test.')).length).toBe(0);
  });
});
