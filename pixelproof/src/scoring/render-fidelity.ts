/**
 * Render Fidelity scoring — calculates per-component and aggregate scores.
 *
 * Formula: RenderFidelity = round(((P - D) / P) * 100, 1)
 *   where P = totalPixels, D = differentPixels
 */

/**
 * Calculate render fidelity score for a single component.
 *
 * @param totalPixels - Total number of pixels in the image
 * @param differentPixels - Number of pixels that differ between screenshot and baseline
 * @returns Score from 0.0 to 100.0 with one decimal place
 */
export function calculateRenderFidelity(
  totalPixels: number,
  differentPixels: number,
): number {
  if (totalPixels === 0) return 100.0;
  return (
    Math.round(((totalPixels - differentPixels) / totalPixels) * 100 * 10) / 10
  );
}

/**
 * Calculate aggregate render fidelity across multiple components.
 * Returns null if no components were rendered (all skipped/error).
 *
 * @param scores - Array of individual render fidelity scores
 * @returns Average score with one decimal place, or null if empty
 */
export function calculateAggregateRenderFidelity(
  scores: number[],
): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}
