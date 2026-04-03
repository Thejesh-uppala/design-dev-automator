/**
 * Render Pipeline — orchestrates the full screenshot → diff → score flow.
 *
 * On startup: runs for all mapped components.
 * On file change: re-renders a single component.
 */

import { resolve, basename } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
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

  // Fetch baseline images from Figma API (for components mapped in nodeIds)
  const baselines = await fetchReferenceImages(config, rootDir);

  // Also pick up manually uploaded baselines from .pixelproof/baselines/
  const baselinesDir = resolve(rootDir, '.pixelproof', 'baselines');
  for (const comp of scoreStore.getAllComponents()) {
    const componentName = deriveComponentName(comp.file);
    if (!baselines.has(componentName)) {
      const manualPath = resolve(baselinesDir, `${componentName}.png`);
      if (existsSync(manualPath)) {
        baselines.set(componentName, manualPath);
      }
    }
  }

  // Ensure screenshots dir exists
  const screenshotsDir = resolve(rootDir, '.pixelproof', 'screenshots');
  mkdirSync(screenshotsDir, { recursive: true });

  // Launch browser
  const runner = new PlaywrightRunner();
  await runner.launch();

  try {
    for (const comp of scoreStore.getAllComponents()) {
      const componentName = deriveComponentName(comp.file);

      // Capture screenshot for every component (not just ones in nodeIds)
      const exportName = comp.exports[0] ?? 'default';
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

      // If baseline exists (from Figma API or manual upload), run pixel diff
      const baselinePath = baselines.get(componentName);
      if (baselinePath) {
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

        const score = calculateRenderFidelity(
          diffResult.totalPixels,
          diffResult.differentPixels,
        );
        scoreStore.setRenderFidelity(comp.file, score, 'rendered');
      } else {
        // Screenshot captured but no baseline to diff against
        scoreStore.setRenderFidelity(comp.file, null, 'rendered');
      }
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

  const screenshotsDir = resolve(rootDir, '.pixelproof', 'screenshots');
  mkdirSync(screenshotsDir, { recursive: true });
  const screenshotPath = resolve(screenshotsDir, `${componentName}.png`);
  const comp = scoreStore.getComponentScore(file);
  const exportName = comp?.exports[0] ?? 'default';

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

  // Check for baseline: from Figma API map or manually uploaded
  let baselinePath = baselines.get(componentName);
  if (!baselinePath) {
    const manualPath = resolve(rootDir, '.pixelproof', 'baselines', `${componentName}.png`);
    if (existsSync(manualPath)) {
      baselinePath = manualPath;
    }
  }

  if (baselinePath) {
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
  } else {
    scoreStore.setRenderFidelity(file, null, 'rendered');
    console.log(
      `Captured screenshot for ${componentName} (no baseline for diff).`,
    );
  }
}

/**
 * Derive a component name from a file path.
 * e.g., "src/components/Button.tsx" → "Button"
 */
export function deriveComponentName(file: string): string {
  const base = basename(file);
  return base.replace(/\.(tsx?|jsx?)$/, '');
}
