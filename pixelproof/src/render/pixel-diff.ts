/**
 * Pixel Diff — compares screenshot against baseline using pixelmatch.
 *
 * Reads PNGs with pngjs, runs pixelmatch, writes diff image.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface DiffResult {
  totalPixels: number;
  differentPixels: number;
  matchPercentage: number;
  diffImagePath: string;
}

/**
 * Compare two PNG images and produce a diff.
 *
 * @param screenshotPath - Path to the screenshot PNG
 * @param baselinePath - Path to the baseline PNG
 * @param outputPath - Path to save the diff PNG
 * @param tolerance - Color distance tolerance (0-255), default 4
 * @returns DiffResult with pixel counts and match percentage
 */
export function diffImages(
  screenshotPath: string,
  baselinePath: string,
  outputPath: string,
  tolerance = 4,
): DiffResult {
  const screenshotPng = PNG.sync.read(readFileSync(screenshotPath));
  const baselinePng = PNG.sync.read(readFileSync(baselinePath));

  let { width: w1, height: h1 } = screenshotPng;
  let { width: w2, height: h2 } = baselinePng;

  // Handle dimension mismatch by cropping to the smaller size
  let img1Data = screenshotPng.data;
  let img2Data = baselinePng.data;

  if (w1 !== w2 || h1 !== h2) {
    console.warn(
      `Image dimension mismatch: screenshot ${w1}×${h1} vs baseline ${w2}×${h2}. Cropping to smaller size.`,
    );

    const width = Math.min(w1, w2);
    const height = Math.min(h1, h2);

    img1Data = cropImageData(screenshotPng.data, w1, width, height);
    img2Data = cropImageData(baselinePng.data, w2, width, height);
    w1 = width;
    h1 = height;
    w2 = width;
    h2 = height;
  }

  const width = w1;
  const height = h1;
  const totalPixels = width * height;

  const diffOutput = new Uint8Array(width * height * 4);
  const threshold = tolerance / 255;

  const differentPixels = pixelmatch(
    new Uint8Array(img1Data.buffer, img1Data.byteOffset, img1Data.byteLength),
    new Uint8Array(img2Data.buffer, img2Data.byteOffset, img2Data.byteLength),
    diffOutput,
    width,
    height,
    { threshold, includeAA: false },
  );

  // Write diff image
  const diffPng = new PNG({ width, height });
  diffPng.data = Buffer.from(diffOutput);
  writeFileSync(outputPath, PNG.sync.write(diffPng));

  const matchPercentage =
    totalPixels === 0
      ? 100.0
      : Math.round(((totalPixels - differentPixels) / totalPixels) * 100 * 10) /
        10;

  return {
    totalPixels,
    differentPixels,
    matchPercentage,
    diffImagePath: outputPath,
  };
}

/**
 * Crop image data to a smaller width/height from top-left corner.
 */
function cropImageData(
  data: Buffer,
  sourceWidth: number,
  targetWidth: number,
  targetHeight: number,
): Buffer {
  const result = Buffer.alloc(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y++) {
    const srcOffset = y * sourceWidth * 4;
    const dstOffset = y * targetWidth * 4;
    data.copy(result, dstOffset, srcOffset, srcOffset + targetWidth * 4);
  }
  return result;
}
