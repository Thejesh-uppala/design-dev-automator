/**
 * Token Compliance Scoring — E3-S8
 *
 * Pure function to calculate Token Compliance percentage.
 * Formula: round(((N - K) / N) * 100, 1)
 */

/**
 * Calculate Token Compliance score.
 *
 * @param totalProperties - N: total number of token-eligible CSS properties with static values
 * @param violationCount - K: number of violations (raw values that should be tokens)
 * @returns Score as a number with 1 decimal place (0.0 – 100.0)
 */
export function calculateTokenCompliance(
  totalProperties: number,
  violationCount: number,
): number {
  if (totalProperties === 0) return 100.0;

  const raw = ((totalProperties - violationCount) / totalProperties) * 100;
  return Math.round(raw * 10) / 10;
}

/**
 * Calculate aggregate Token Compliance across multiple component scores.
 * Each component is weighted equally.
 *
 * @param scores - Array of per-component scores (0.0 – 100.0)
 * @returns Aggregate score with 1 decimal place
 */
export function calculateAggregateCompliance(scores: number[]): number {
  if (scores.length === 0) return 0;

  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}
