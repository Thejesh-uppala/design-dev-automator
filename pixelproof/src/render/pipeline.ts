/**
 * Render Pipeline — orchestrates the full screenshot → diff → score flow.
 *
 * On startup: runs for all mapped components.
 * On file change: re-renders a single component.
 */

import { resolve, basename } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { PixelProofConfig } from '../config/schema.js';
import type { ScoreStore } from '../scoring/store.js';
import { isChromiumInstalled } from './playwright-setup.js';
import { PlaywrightRunner } from './playwright-runner.js';
import { fetchReferenceImages } from './figma-images.js';
import { diffImages } from './pixel-diff.js';
import { calculateRenderFidelity } from '../scoring/render-fidelity.js';

export interface RenderPipelineResult {
  rendered: number;
  skipped: number;
  errors: number;
}

/**
 * Run the full render fidelity pipeline for all mapped components.
 */
export async function renderPipeline(
  config: PixelProofConfig,
  scoreStore: ScoreStore,
  rootDir: string,
  port: number,
): Promise<RenderPipelineResult> {
  const result: RenderPipelineResult = { rendered: 0, skipped: 0, errors: 0 };

  if (!config.render.enabled) {
    // Mark all components as skipped
    for (const comp of scoreStore.getAllComponents()) {
      scoreStore.setRenderFidelity(comp.file, null, 'skipped');
      result.skipped++;
    }
    return result;
  }

  if (!(await isChromiumInstalled())) {
    console.warn(
      "Chromium not found. Run 'npx pixelproof install' first.",
    );
    console.warn(
      'Continuing in AST-only mode (render fidelity disabled).',
    );
    for (const comp of scoreStore.getAllComponents()) {
      scoreStore.setRenderFidelity(comp.file, null, 'skipped');
      result.skipped++;
    }
    return result;
  }

  const nodeIds = config.figma?.nodeIds ?? {};

  // Fetch baseline images
  const baselines = await fetchReferenceImages(config, rootDir);

  // Ensure screenshots dir exists
  const screenshotsDir = resolve(rootDir, '.pixelproof', 'screenshots');
  mkdirSync(screenshotsDir, { recursive: true });

  // Launch browser
  const runner = new PlaywrightRunner();
  await runner.launch();

  try {
    for (const comp of scoreStore.getAllComponents()) {
      // Derive component name from file path
      const componentName = deriveComponentName(comp.file);

      if (!nodeIds[componentName]) {
        scoreStore.setRenderFidelity(comp.file, null, 'skipped');
        result.skipped++;
        continue;
      }

      const baselinePath = baselines.get(componentName);
      if (!baselinePath) {
        console.warn(
          `No baseline image for ${componentName} — skipping render fidelity.`,
        );
        scoreStore.setRenderFidelity(comp.file, null, 'skipped');
        result.skipped++;
        continue;
      }

      // Capture screenshot
      const exportName = comp.exports[0] ?? componentName;
      const screenshotPath = resolve(screenshotsDir, `${componentName}.png`);

      const screenshot = await runner.captureScreenshot(
        comp.file,
        exportName,
        config.render.viewport,
        port,
        screenshotPath,
      );

      if (!screenshot.success) {
        console.warn(
          `Render error for ${componentName}: ${screenshot.error}`,
        );
        scoreStore.setRenderFidelity(comp.file, null, 'error');
        result.errors++;
        continue;
      }

      // Pixel diff
      const diffPath = resolve(
        screenshotsDir,
        `${componentName}.diff.png`,
      );
      const diffResult = diffImages(
        screenshotPath,
        baselinePath,
        diffPath,
        config.render.tolerance,
      );

      // Calculate and store score
      const score = calculateRenderFidelity(
        diffResult.totalPixels,
        diffResult.differentPixels,
      );
      scoreStore.setRenderFidelity(comp.file, score, 'rendered');
      result.rendered++;
    }
  } finally {
    await runner.close();
  }

  return result;
}

/**
 * Re-render a single component after file change.
 */
export async function renderSingleComponent(
  file: string,
  config: PixelProofConfig,
  scoreStore: ScoreStore,
  runner: PlaywrightRunner,
  rootDir: string,
  port: number,
  baselines: Map<string, string>,
): Promise<void> {
  const componentName = deriveComponentName(file);
  const nodeIds = config.figma?.nodeIds ?? {};

  if (!nodeIds[componentName]) {
    return; // Not mapped — skip
  }

  const baselinePath = baselines.get(componentName);
  if (!baselinePath) {
    return;
  }

  const screenshotsDir = resolve(rootDir, '.pixelproof', 'screenshots');
  const screenshotPath = resolve(screenshotsDir, `${componentName}.png`);
  const comp = scoreStore.getComponentScore(file);
  const exportName = comp?.exports[0] ?? componentName;

  const screenshot = await runner.captureScreenshot(
    file,
    exportName,
    config.render.viewport,
    port,
    screenshotPath,
  );

  if (!screenshot.success) {
    scoreStore.setRenderFidelity(file, null, 'error');
    return;
  }

  const diffPath = resolve(screenshotsDir, `${componentName}.diff.png`);
  const diffResult = diffImages(
    screenshotPath,
    baselinePath,
    diffPath,
    config.render.tolerance,
  );

  const score = calculateRenderFidelity(
    diffResult.totalPixels,
    diffResult.differentPixels,
  );
  scoreStore.setRenderFidelity(file, score, 'rendered');

  console.log(
    `Rescanned + re-rendered ${componentName}. Render Fidelity: ${score}%`,
  );
}

/**
 * Derive a component name from a file path.
 * e.g., "src/components/Button.tsx" → "Button"
 */
export function deriveComponentName(file: string): string {
  const base = basename(file);
  return base.replace(/\.(tsx?|jsx?)$/, '');
}
