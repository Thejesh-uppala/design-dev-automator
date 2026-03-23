import { describe, it, expect } from 'vitest';
import {
  calculateRenderFidelity,
  calculateAggregateRenderFidelity,
} from '../render-fidelity.js';

describe('calculateRenderFidelity', () => {
  it('returns 100.0 for identical images (0 diff)', () => {
    expect(calculateRenderFidelity(1_000_000, 0)).toBe(100.0);
  });

  it('returns 90.0 for 10% diff', () => {
    expect(calculateRenderFidelity(1_000_000, 100_000)).toBe(90.0);
  });

  it('returns 0.0 for 100% diff', () => {
    expect(calculateRenderFidelity(1_000_000, 1_000_000)).toBe(0.0);
  });

  it('returns 95.0 for 5% diff', () => {
    expect(calculateRenderFidelity(1_000_000, 50_000)).toBe(95.0);
  });

  it('returns 100.0 when totalPixels is 0', () => {
    expect(calculateRenderFidelity(0, 0)).toBe(100.0);
  });

  it('rounds to one decimal place', () => {
    // 1000 total, 33 diff → (1000-33)/1000 * 100 = 96.7
    expect(calculateRenderFidelity(1000, 33)).toBe(96.7);
  });
});

describe('calculateAggregateRenderFidelity', () => {
  it('returns null for empty array', () => {
    expect(calculateAggregateRenderFidelity([])).toBeNull();
  });

  it('returns single score for one component', () => {
    expect(calculateAggregateRenderFidelity([75.5])).toBe(75.5);
  });

  it('averages multiple scores', () => {
    // (90 + 80 + 100) / 3 = 90.0
    expect(calculateAggregateRenderFidelity([90, 80, 100])).toBe(90.0);
  });

  it('rounds aggregate to one decimal', () => {
    // (90 + 85) / 2 = 87.5
    expect(calculateAggregateRenderFidelity([90, 85])).toBe(87.5);
  });

  it('handles fractional scores', () => {
    // (91.2 + 87.5 + 100.0) / 3 = 92.9
    expect(calculateAggregateRenderFidelity([91.2, 87.5, 100.0])).toBe(92.9);
  });
});
