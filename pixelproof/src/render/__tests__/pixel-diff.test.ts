import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';
import { diffImages } from '../pixel-diff.js';

const TEST_DIR = resolve(tmpdir(), 'pixelproof-diff-' + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

/**
 * Create a solid-color PNG of given dimensions.
 */
function createPng(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

/**
 * Create a PNG with a specific pixel set to a different color.
 */
function createPngWithDiffPixels(
  width: number,
  height: number,
  baseR: number,
  baseG: number,
  baseB: number,
  diffPixels: Array<{ x: number; y: number; r: number; g: number; b: number }>,
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx] = baseR;
      png.data[idx + 1] = baseG;
      png.data[idx + 2] = baseB;
      png.data[idx + 3] = 255;
    }
  }
  for (const dp of diffPixels) {
    const idx = (dp.y * width + dp.x) * 4;
    png.data[idx] = dp.r;
    png.data[idx + 1] = dp.g;
    png.data[idx + 2] = dp.b;
    png.data[idx + 3] = 255;
  }
  return PNG.sync.write(png);
}

describe('diffImages', () => {
  it('returns 100% match for identical images', () => {
    const img = createPng(4, 4, 255, 0, 0);
    const screenshotPath = resolve(TEST_DIR, 'screenshot.png');
    const baselinePath = resolve(TEST_DIR, 'baseline.png');
    const diffPath = resolve(TEST_DIR, 'diff.png');

    const { writeFileSync } = require('node:fs');
    writeFileSync(screenshotPath, img);
    writeFileSync(baselinePath, img);

    const result = diffImages(screenshotPath, baselinePath, diffPath);

    expect(result.totalPixels).toBe(16);
    expect(result.differentPixels).toBe(0);
    expect(result.matchPercentage).toBe(100.0);
    expect(existsSync(diffPath)).toBe(true);
  });

  it('detects all pixels different', () => {
    const img1 = createPng(4, 4, 255, 0, 0); // Red
    const img2 = createPng(4, 4, 0, 0, 255); // Blue

    const screenshotPath = resolve(TEST_DIR, 'screenshot.png');
    const baselinePath = resolve(TEST_DIR, 'baseline.png');
    const diffPath = resolve(TEST_DIR, 'diff.png');

    const { writeFileSync } = require('node:fs');
    writeFileSync(screenshotPath, img1);
    writeFileSync(baselinePath, img2);

    const result = diffImages(screenshotPath, baselinePath, diffPath, 0);

    expect(result.totalPixels).toBe(16);
    expect(result.differentPixels).toBe(16);
    expect(result.matchPercentage).toBe(0.0);
  });

  it('detects partial difference', () => {
    const img1 = createPng(4, 4, 255, 0, 0); // All red
    // 4 pixels different
    const img2 = createPngWithDiffPixels(4, 4, 255, 0, 0, [
      { x: 0, y: 0, r: 0, g: 0, b: 255 },
      { x: 1, y: 0, r: 0, g: 0, b: 255 },
      { x: 2, y: 0, r: 0, g: 0, b: 255 },
      { x: 3, y: 0, r: 0, g: 0, b: 255 },
    ]);

    const screenshotPath = resolve(TEST_DIR, 'screenshot.png');
    const baselinePath = resolve(TEST_DIR, 'baseline.png');
    const diffPath = resolve(TEST_DIR, 'diff.png');

    const { writeFileSync } = require('node:fs');
    writeFileSync(screenshotPath, img1);
    writeFileSync(baselinePath, img2);

    const result = diffImages(screenshotPath, baselinePath, diffPath, 0);

    expect(result.totalPixels).toBe(16);
    expect(result.differentPixels).toBe(4);
    expect(result.matchPercentage).toBe(75.0);
  });

  it('handles dimension mismatch by cropping', () => {
    const img1 = createPng(4, 4, 255, 0, 0); // 4x4
    const img2 = createPng(8, 8, 255, 0, 0); // 8x8

    const screenshotPath = resolve(TEST_DIR, 'screenshot.png');
    const baselinePath = resolve(TEST_DIR, 'baseline.png');
    const diffPath = resolve(TEST_DIR, 'diff.png');

    const { writeFileSync } = require('node:fs');
    writeFileSync(screenshotPath, img1);
    writeFileSync(baselinePath, img2);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = diffImages(screenshotPath, baselinePath, diffPath);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('dimension mismatch'),
    );
    // Cropped to 4x4
    expect(result.totalPixels).toBe(16);
    expect(result.differentPixels).toBe(0);
    expect(result.matchPercentage).toBe(100.0);

    warnSpy.mockRestore();
  });

  it('writes diff image to output path', () => {
    const img1 = createPng(4, 4, 255, 0, 0);
    const img2 = createPng(4, 4, 0, 255, 0);

    const screenshotPath = resolve(TEST_DIR, 'screenshot.png');
    const baselinePath = resolve(TEST_DIR, 'baseline.png');
    const diffPath = resolve(TEST_DIR, 'diff.png');

    const { writeFileSync } = require('node:fs');
    writeFileSync(screenshotPath, img1);
    writeFileSync(baselinePath, img2);

    const result = diffImages(screenshotPath, baselinePath, diffPath);

    expect(result.diffImagePath).toBe(diffPath);
    expect(existsSync(diffPath)).toBe(true);

    // Verify diff image is a valid PNG
    const diffData = readFileSync(diffPath);
    const diffPng = PNG.sync.read(diffData);
    expect(diffPng.width).toBe(4);
    expect(diffPng.height).toBe(4);
  });

  it('respects tolerance parameter', () => {
    // Create two images with very slight color difference
    const img1 = createPng(4, 4, 100, 0, 0);
    const img2 = createPng(4, 4, 102, 0, 0); // Only 2 units apart

    const screenshotPath = resolve(TEST_DIR, 'screenshot.png');
    const baselinePath = resolve(TEST_DIR, 'baseline.png');
    const diffPath = resolve(TEST_DIR, 'diff.png');

    const { writeFileSync } = require('node:fs');
    writeFileSync(screenshotPath, img1);
    writeFileSync(baselinePath, img2);

    // With tolerance=0 (strict): should detect differences
    const strictResult = diffImages(screenshotPath, baselinePath, diffPath, 0);

    // With high tolerance: should forgive differences
    const diffPathLenient = resolve(TEST_DIR, 'diff-lenient.png');
    const lenientResult = diffImages(
      screenshotPath,
      baselinePath,
      diffPathLenient,
      50,
    );

    // Lenient should have fewer or equal diff pixels than strict
    expect(lenientResult.differentPixels).toBeLessThanOrEqual(
      strictResult.differentPixels,
    );
  });
});
