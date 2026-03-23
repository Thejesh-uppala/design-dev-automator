import { describe, it, expect, vi } from 'vitest';
import { ScoreStore } from '../store.js';
import type { Violation, ScoreEvent } from '../types.js';

function makeViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    id: 'test-id',
    file: 'Button.tsx',
    line: 42,
    column: 12,
    prop: 'color',
    found: '#FF5733',
    type: 'color',
    nearestToken: 'var(--color-primary-500)',
    figmaToken: 'colors/primary/500',
    resolvedValue: '#FF5733',
    source: 'jsx-style',
    confidence: 'exact',
    ...overrides,
  };
}

describe('ScoreStore', () => {
  it('setViolations: 3 violations out of 10 → tokenCompliance=70.0', () => {
    const store = new ScoreStore();
    const violations = [makeViolation(), makeViolation(), makeViolation()];

    store.setViolations('Button.tsx', violations, 10);

    const score = store.getComponentScore('Button.tsx');
    expect(score).toBeDefined();
    expect(score!.tokenCompliance).toBe(70.0);
    expect(score!.violations).toHaveLength(3);
  });

  it('setViolations: 0 violations out of 5 → tokenCompliance=100.0', () => {
    const store = new ScoreStore();

    store.setViolations('Card.tsx', [], 5);

    const score = store.getComponentScore('Card.tsx');
    expect(score!.tokenCompliance).toBe(100.0);
    expect(score!.violations).toHaveLength(0);
  });

  it('setViolations: 0 violations out of 0 → tokenCompliance=100.0', () => {
    const store = new ScoreStore();

    store.setViolations('Empty.tsx', [], 0);

    const score = store.getComponentScore('Empty.tsx');
    expect(score!.tokenCompliance).toBe(100.0);
  });

  it('setRenderFidelity sets score and status', () => {
    const store = new ScoreStore();

    store.setRenderFidelity('Button.tsx', 91.2, 'rendered');

    const score = store.getComponentScore('Button.tsx');
    expect(score!.renderFidelity).toBe(91.2);
    expect(score!.renderStatus).toBe('rendered');
  });

  it('setRenderFidelity with null score and skipped status', () => {
    const store = new ScoreStore();

    store.setRenderFidelity('Card.tsx', null, 'skipped');

    const score = store.getComponentScore('Card.tsx');
    expect(score!.renderFidelity).toBeNull();
    expect(score!.renderStatus).toBe('skipped');
  });

  it('getComponentScore returns correct data after both setters', () => {
    const store = new ScoreStore();
    const violations = [makeViolation()];

    store.setViolations('Button.tsx', violations, 10);
    store.setRenderFidelity('Button.tsx', 95.0, 'rendered');

    const score = store.getComponentScore('Button.tsx');
    expect(score!.file).toBe('Button.tsx');
    expect(score!.tokenCompliance).toBe(90.0);
    expect(score!.renderFidelity).toBe(95.0);
    expect(score!.renderStatus).toBe('rendered');
    expect(score!.violations).toHaveLength(1);
  });

  it('getComponentScore returns undefined for unknown file', () => {
    const store = new ScoreStore();
    expect(store.getComponentScore('Unknown.tsx')).toBeUndefined();
  });

  it('getAggregateScore excludes skipped/error from renderFidelity', () => {
    const store = new ScoreStore();

    store.setViolations('Button.tsx', [makeViolation()], 10);
    store.setRenderFidelity('Button.tsx', 90.0, 'rendered');

    store.setViolations('Card.tsx', [], 5);
    store.setRenderFidelity('Card.tsx', null, 'skipped');

    const agg = store.getAggregateScore();
    expect(agg.renderedComponents).toBe(1);
    expect(agg.skippedComponents).toBe(1);
    expect(agg.renderFidelity).toBe(90.0); // only Button counted
    expect(agg.totalComponents).toBe(2);
  });

  it('getAggregateScore sums totalViolations across components', () => {
    const store = new ScoreStore();

    store.setViolations('A.tsx', [makeViolation(), makeViolation()], 10);
    store.setViolations('B.tsx', [makeViolation()], 5);

    const agg = store.getAggregateScore();
    expect(agg.totalViolations).toBe(3);
  });

  it('getAggregateScore returns zeros when no components', () => {
    const store = new ScoreStore();
    const agg = store.getAggregateScore();

    expect(agg.tokenCompliance).toBe(0);
    expect(agg.renderFidelity).toBe(0);
    expect(agg.totalComponents).toBe(0);
    expect(agg.totalViolations).toBe(0);
  });

  it('getAllComponents returns array of all entries', () => {
    const store = new ScoreStore();

    store.setViolations('A.tsx', [], 5);
    store.setViolations('B.tsx', [], 3);

    const all = store.getAllComponents();
    expect(all).toHaveLength(2);
    expect(all.map((c) => c.file).sort()).toEqual(['A.tsx', 'B.tsx']);
  });

  it('subscribe fires on setViolations with correct payload', () => {
    const store = new ScoreStore();
    const events: ScoreEvent[] = [];

    store.subscribe((e) => events.push(e));
    store.setViolations('Button.tsx', [], 5);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'violation', file: 'Button.tsx' });
  });

  it('subscribe fires on setRenderFidelity with correct payload', () => {
    const store = new ScoreStore();
    const events: ScoreEvent[] = [];

    store.subscribe((e) => events.push(e));
    store.setRenderFidelity('Button.tsx', 90.0, 'rendered');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'render', file: 'Button.tsx' });
  });

  it('unsubscribe stops receiving events', () => {
    const store = new ScoreStore();
    const events: ScoreEvent[] = [];

    const unsub = store.subscribe((e) => events.push(e));
    store.setViolations('A.tsx', [], 5);
    expect(events).toHaveLength(1);

    unsub();
    store.setViolations('B.tsx', [], 3);
    expect(events).toHaveLength(1); // no new event
  });

  it('multiple subscribers all receive events', () => {
    const store = new ScoreStore();
    const events1: ScoreEvent[] = [];
    const events2: ScoreEvent[] = [];

    store.subscribe((e) => events1.push(e));
    store.subscribe((e) => events2.push(e));
    store.setViolations('Button.tsx', [], 5);

    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);
    expect(events1[0]).toEqual(events2[0]);
  });
});
