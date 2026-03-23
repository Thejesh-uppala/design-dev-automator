/**
 * Playwright Screenshot Runner — captures component screenshots via headless Chromium.
 *
 * Uses a single browser instance across all components for performance.
 * Navigates to the harness URL for each component and captures #pixelproof-root.
 */

import type { ViewportConfig } from '../config/schema.js';

export interface ScreenshotResult {
  path: string;
  success: boolean;
  error?: string;
}

interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}

interface PageLike {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  goto(url: string, options?: { waitUntil?: string }): Promise<void>;
  waitForSelector(
    selector: string,
    options?: { timeout?: number },
  ): Promise<unknown>;
  $(selector: string): Promise<ElementLike | null>;
  close(): Promise<void>;
}

interface ElementLike {
  screenshot(options?: { path?: string }): Promise<Buffer>;
}

const RENDER_TIMEOUT_MS = 10_000;

export class PlaywrightRunner {
  private browser: BrowserLike | null = null;

  /**
   * Launch headless Chromium via playwright-core.
   */
  async launch(): Promise<void> {
    const pw = await import('playwright-core');
    this.browser = (await pw.chromium.launch({
      headless: true,
    })) as unknown as BrowserLike;
  }

  /**
   * Capture a screenshot of a rendered component.
   *
   * @param componentFile - Relative path to the component file
   * @param exportName - Named export of the component
   * @param viewport - Viewport dimensions
   * @param port - Harness server port
   * @param outputPath - Absolute path to save the screenshot PNG
   */
  async captureScreenshot(
    componentFile: string,
    exportName: string,
    viewport: ViewportConfig,
    port: number,
    outputPath: string,
  ): Promise<ScreenshotResult> {
    if (!this.browser) {
      return {
        path: outputPath,
        success: false,
        error: 'Browser not launched. Call launch() first.',
      };
    }

    const page = await this.browser.newPage();

    try {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      const encodedFile = encodeURIComponent(componentFile);
      const encodedExport = encodeURIComponent(exportName);
      const url = `http://localhost:${port}/harness?component=${encodedFile}&export=${encodedExport}`;

      await page.goto(url, { waitUntil: 'networkidle' });

      // Wait for the component to render inside #pixelproof-root
      try {
        await page.waitForSelector('#pixelproof-root > *', {
          timeout: RENDER_TIMEOUT_MS,
        });
      } catch {
        return {
          path: outputPath,
          success: false,
          error: `Component render timeout after ${RENDER_TIMEOUT_MS}ms`,
        };
      }

      // Check for error boundary
      const errorEl = await page.$('#pixelproof-error');
      if (errorEl) {
        return {
          path: outputPath,
          success: false,
          error: 'Component threw during render (ErrorBoundary triggered)',
        };
      }

      // Capture screenshot of the component root
      const rootEl = await page.$('#pixelproof-root');
      if (!rootEl) {
        return {
          path: outputPath,
          success: false,
          error: '#pixelproof-root element not found',
        };
      }

      await rootEl.screenshot({ path: outputPath });

      return { path: outputPath, success: true };
    } finally {
      await page.close();
    }
  }

  /**
   * Close the browser instance.
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
