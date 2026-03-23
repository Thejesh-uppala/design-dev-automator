/**
 * Playwright Chromium setup — manages browser install for render fidelity.
 *
 * Chromium is NOT downloaded on `npm install`.
 * Only when `npx pixelproof install` is explicitly run.
 */

import { existsSync } from 'node:fs';

/**
 * Check if Playwright Chromium is installed and the binary exists.
 * Uses dynamic import to avoid loading playwright-core unless needed.
 */
export async function isChromiumInstalled(): Promise<boolean> {
  try {
    const pw = await import('playwright-core');
    const execPath: string = pw.chromium.executablePath();
    return existsSync(execPath);
  } catch {
    return false;
  }
}

/**
 * Install Playwright Chromium browser.
 * Uses Playwright's built-in browser management.
 */
export async function installChromium(): Promise<void> {
  const pw = await import('playwright-core');

  // Check if already installed
  try {
    const execPath = pw.chromium.executablePath();
    if (existsSync(execPath)) {
      console.log('Chromium already installed.');
      return;
    }
  } catch {
    // executablePath may throw if not installed — continue to install
  }

  console.log('Downloading Chromium...');

  const { execSync } = await import('node:child_process');
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execSync(`${npxCmd} playwright install chromium`, {
    stdio: 'inherit',
    env: { ...process.env },
  });

  console.log('Chromium installed successfully.');
}
