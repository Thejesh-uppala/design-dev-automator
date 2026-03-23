import { describe, it, expect } from 'vitest';
import {
  calculateTokenCompliance,
  calculateAggregateCompliance,
} from '../token-compliance.js';

describe('Token Compliance Scoring', () => {
  it('10 properties, 3 violations → 70.0', () => {
    expect(calculateTokenCompliance(10, 3)).toBe(70.0);
  });

  it('10 properties, 0 violations → 100.0', () => {
    expect(calculateTokenCompliance(10, 0)).toBe(100.0);
  });

  it('10 properties, 10 violations → 0.0', () => {
    expect(calculateTokenCompliance(10, 10)).toBe(0.0);
  });

  it('0 properties, 0 violations → 100.0', () => {
    expect(calculateTokenCompliance(0, 0)).toBe(100.0);
  });

  it('7 properties, 2 violations → 71.4', () => {
    expect(calculateTokenCompliance(7, 2)).toBe(71.4);
  });

  it('1 property, 1 violation → 0.0', () => {
    expect(calculateTokenCompliance(1, 1)).toBe(0.0);
  });

  it('100 properties, 1 violation → 99.0', () => {
    expect(calculateTokenCompliance(100, 1)).toBe(99.0);
  });
});

describe('Aggregate Compliance', () => {
  it('averages multiple scores equally', () => {
    expect(calculateAggregateCompliance([100, 50])).toBe(75.0);
  });

  it('handles single score', () => {
    expect(calculateAggregateCompliance([71.4])).toBe(71.4);
  });

  it('returns 0 for empty array', () => {
    expect(calculateAggregateCompliance([])).toBe(0);
  });

  it('rounds to 1 decimal place', () => {
    expect(calculateAggregateCompliance([33.3, 66.7])).toBe(50.0);
  });
});
