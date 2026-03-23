import chokidar, { type FSWatcher } from 'chokidar';
import { extname, resolve, relative } from 'node:path';
import fg from 'fast-glob';
import type { ScanConfig } from '../config/schema.js';

export interface WatchEvent {
  file: string;
  event: 'change' | 'add' | 'unlink';
}

type WatchCallback = (event: WatchEvent) => void;

const DEBOUNCE_MS = 300;

/**
 * Watches project files for changes and emits debounced events.
 *
 * The watcher does NOT trigger scans itself — it emits events that consumers
 * (like the CLI start command) subscribe to for re-scanning.
 */
export class FileWatcher {
  private rootDir: string;
  private scanConfig: ScanConfig;
  private watcher: FSWatcher | null = null;
  private listeners: WatchCallback[] = [];
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private allowedExtensions: Set<string>;

  constructor(rootDir: string, scanConfig: ScanConfig) {
    this.rootDir = rootDir;
    this.scanConfig = scanConfig;
    this.allowedExtensions = new Set(
      scanConfig.fileTypes.map((t) => `.${t}`),
    );
  }

  /**
   * Begin watching. Resolves when chokidar reports 'ready'.
   *
   * Resolves include glob patterns to base directory paths for chokidar.
   * Chokidar v5 on Windows requires absolute directory paths, not glob patterns.
   */
  start(): Promise<void> {
    return new Promise<void>((resolvePromise) => {
      // Convert glob patterns like 'src/**' to directory paths like '/abs/path/src'
      const watchPaths = this.scanConfig.include.map((pattern) => {
        const base = pattern.replace(/\/?\*\*.*$/, '') || '.';
        return resolve(this.rootDir, base);
      });

      // Build ignored patterns: convert globs to regex or use picomatch-compatible patterns
      const ignored = this.scanConfig.exclude.map((pattern) => {
        // Convert glob exclude patterns to work with absolute paths
        // Patterns like **/*.test.tsx should match any file ending in .test.tsx
        return new RegExp(
          pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/\\\\]*'),
        );
      });

      this.watcher = chokidar.watch(watchPaths, {
        ignored,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      this.watcher.on('ready', () => resolvePromise());

      this.watcher.on('change', (file: string) => this.handleEvent(file, 'change'));
      this.watcher.on('add', (file: string) => this.handleEvent(file, 'add'));
      this.watcher.on('unlink', (file: string) => this.handleEvent(file, 'unlink'));
    });
  }

  /**
   * Register a change handler. Multiple handlers supported.
   */
  onChange(callback: WatchCallback): void {
    this.listeners.push(callback);
  }

  /**
   * Stop watching. Clears all timers and closes chokidar.
   */
  async stop(): Promise<void> {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private handleEvent(absolutePath: string, event: WatchEvent['event']): void {
    // Filter by allowed extensions
    if (!this.allowedExtensions.has(extname(absolutePath).toLowerCase())) {
      return;
    }

    // Convert absolute path to relative path from rootDir
    const file = relative(this.rootDir, absolutePath).replace(/\\/g, '/');

    // Per-file debounce
    const existing = this.debounceTimers.get(file);
    if (existing) {
      clearTimeout(existing);
    }

    this.debounceTimers.set(
      file,
      setTimeout(() => {
        this.debounceTimers.delete(file);
        const watchEvent: WatchEvent = { file, event };
        for (const cb of this.listeners) {
          cb(watchEvent);
        }
      }, DEBOUNCE_MS),
    );
  }
}
