/**
 * Figma Reference Image Fetch — downloads baseline PNGs for mapped components.
 *
 * Uses the Figma REST API to export node images as PNGs.
 * Images are cached in .pixelproof/baselines/ and only re-fetched when forced.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PixelProofConfig } from '../config/schema.js';
import { resolvePAT } from '../tokens/figma-rest.js';

const FIGMA_API_BASE = 'https://api.figma.com';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_CONCURRENT = 5;

export interface FetchImagesOptions {
  force?: boolean;
}

/**
 * Fetch reference images for all components mapped in figma.nodeIds.
 *
 * @returns Map of componentName → absolute path to baseline PNG
 */
export async function fetchReferenceImages(
  config: PixelProofConfig,
  rootDir: string,
  options: FetchImagesOptions = {},
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const nodeIds = config.figma?.nodeIds;

  if (!nodeIds || Object.keys(nodeIds).length === 0) {
    return result;
  }

  const baselinesDir = resolve(rootDir, '.pixelproof', 'baselines');
  mkdirSync(baselinesDir, { recursive: true });

  // Determine which components need fetching
  const toFetch: Array<{ name: string; nodeId: string }> = [];
  for (const [name, nodeId] of Object.entries(nodeIds)) {
    const baselinePath = resolve(baselinesDir, `${name}.png`);
    if (!options.force && existsSync(baselinePath)) {
      // Already cached
      result.set(name, baselinePath);
      continue;
    }
    toFetch.push({ name, nodeId });
  }

  if (toFetch.length === 0) {
    return result;
  }

  // Resolve PAT
  const pat = resolvePAT(config.figma?.personalAccessToken);
  if (!pat) {
    console.warn(
      'No Figma PAT available. Set FIGMA_PAT env var or add figma.personalAccessToken to config.',
    );
    return result;
  }

  const fileId = config.figma!.fileId;

  // Batch fetch image URLs from Figma API
  const nodeIdList = toFetch.map((c) => c.nodeId);
  const imageUrls = await fetchImageUrls(fileId, nodeIdList, pat);

  // Download images with concurrency limit
  const chunks = chunkArray(toFetch, MAX_CONCURRENT);
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async ({ name, nodeId }) => {
        const url = imageUrls[nodeId];
        if (!url) {
          console.warn(
            `Figma node ${nodeId} not found for ${name} — no reference image available.`,
          );
          return;
        }

        try {
          const imageData = await downloadImage(url);
          const baselinePath = resolve(baselinesDir, `${name}.png`);
          writeFileSync(baselinePath, imageData);
          result.set(name, baselinePath);
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : String(error);
          console.warn(
            `Failed to download reference image for ${name}: ${msg}`,
          );
        }
      }),
    );
  }

  return result;
}

/**
 * Fetch image URLs for a batch of node IDs from the Figma API.
 */
export async function fetchImageUrls(
  fileId: string,
  nodeIds: string[],
  pat: string,
): Promise<Record<string, string>> {
  const ids = nodeIds.join(',');
  const url = `${FIGMA_API_BASE}/v1/images/${fileId}?ids=${encodeURIComponent(ids)}&format=png&scale=2`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'X-FIGMA-TOKEN': pat },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Figma Images API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      images: Record<string, string | null>;
    };
    const result: Record<string, string> = {};
    for (const [id, imageUrl] of Object.entries(data.images ?? {})) {
      if (imageUrl) {
        result[id] = imageUrl;
      }
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Download an image from a URL and return it as a Buffer.
 */
async function downloadImage(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Image download failed: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Split array into chunks of given size.
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
