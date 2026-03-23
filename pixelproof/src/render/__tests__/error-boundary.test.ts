import { describe, it, expect } from 'vitest';
import { generateHarnessEntry } from '../vite-plugin.js';
import type { PixelProofPluginOptions } from '../vite-plugin.js';
import type { PixelProofConfig } from '../../config/schema.js';
import { ScoreStore } from '../../scoring/store.js';

function makeConfig(): PixelProofConfig {
  return {
    scan: { include: ['src/**'], exclude: [], fileTypes: ['tsx', 'ts'] },
    tokens: { format: 'dtcg', fallbackDir: 'tokens/' },
    dashboard: { port: 3001 },
    render: {
      enabled: true,
      viewport: { width: 1440, height: 900 },
      tolerance: 4,
      theme: 'light',
    },
  };
}

function makeOptions(): PixelProofPluginOptions {
  return { config: makeConfig(), providers: [] };
}

describe('ErrorBoundary in harness entry', () => {
  const code = generateHarnessEntry(makeOptions());

  it('contains ErrorBoundaryClass with getDerivedStateFromError', () => {
    expect(code).toContain('class ErrorBoundaryClass');
    expect(code).toContain('getDerivedStateFromError');
  });

  it('contains componentDidCatch that calls onError', () => {
    expect(code).toContain('componentDidCatch');
    expect(code).toContain('this.props.onError');
  });

  it('resets error state on resetKey change (HMR support)', () => {
    expect(code).toContain('componentDidUpdate');
    expect(code).toContain('resetKey');
    expect(code).toContain("this.setState({ hasError: false })");
  });

  it('posts render-error to parent window', () => {
    expect(code).toContain('window.parent.postMessage');
    expect(code).toContain("type: 'render-error'");
    expect(code).toContain('component: componentName');
  });

  it('shows error message and stack trace in fallback UI', () => {
    expect(code).toContain('Render Error:');
    expect(code).toContain('error.message');
    expect(code).toContain('error.stack');
  });

  it('truncates stack trace to 5 lines', () => {
    expect(code).toContain(".slice(0, 5)");
  });

  it('wraps rendered component in ErrorBoundary', () => {
    // The HarnessApp renders ErrorBoundary around the component
    expect(code).toContain('React.createElement(\n    ErrorBoundary');
  });
});

describe('ScoreStore render status integration', () => {
  it('error components are excluded from aggregate render fidelity', () => {
    const store = new ScoreStore();

    // 3 components: 2 render fine, 1 errors
    store.setViolations('Button.tsx', [], 5);
    store.setRenderFidelity('Button.tsx', 95.0, 'rendered');

    store.setViolations('Card.tsx', [], 3);
    store.setRenderFidelity('Card.tsx', 88.0, 'rendered');

    store.setViolations('Table.tsx', [], 4);
    store.setRenderFidelity('Table.tsx', null, 'error');

    const agg = store.getAggregateScore();
    expect(agg.renderedComponents).toBe(2);
    expect(agg.skippedComponents).toBe(1);
    // Render fidelity is avg of rendered only: (95+88)/2 = 91.5
    expect(agg.renderFidelity).toBe(91.5);
    // Token compliance includes all: (100+100+100)/3 = 100
    expect(agg.tokenCompliance).toBe(100);
  });

  it('error components do NOT contribute 0% to render fidelity', () => {
    const store = new ScoreStore();

    store.setViolations('A.tsx', [], 5);
    store.setRenderFidelity('A.tsx', 80.0, 'rendered');

    store.setViolations('B.tsx', [], 3);
    store.setRenderFidelity('B.tsx', null, 'error');

    const agg = store.getAggregateScore();
    // Only 1 rendered component with 80%, not (80+0)/2=40%
    expect(agg.renderFidelity).toBe(80);
  });

  it('AST token compliance is unaffected by render errors', () => {
    const store = new ScoreStore();

    // Component with token violations AND render error
    store.setViolations('Broken.tsx', [
      {
        id: 'v1',
        file: 'Broken.tsx',
        line: 5,
        column: 10,
        prop: 'color',
        found: '#6366f1',
        type: 'color',
        nearestToken: 'colors/primary',
        figmaToken: '--colors-primary',
        resolvedValue: '#6366f1',
        source: 'jsx-style',
        confidence: 'exact',
      },
    ], 5);
    store.setRenderFidelity('Broken.tsx', null, 'error');

    const score = store.getComponentScore('Broken.tsx');
    // Token compliance calculated from AST (4/5 = 80%)
    expect(score?.tokenCompliance).toBe(80);
    // Render status is error
    expect(score?.renderStatus).toBe('error');
  });

  it('all error components produce 0 rendered + correct skipped count', () => {
    const store = new ScoreStore();

    store.setViolations('A.tsx', [], 1);
    store.setRenderFidelity('A.tsx', null, 'error');

    store.setViolations('B.tsx', [], 1);
    store.setRenderFidelity('B.tsx', null, 'error');

    const agg = store.getAggregateScore();
    expect(agg.renderedComponents).toBe(0);
    expect(agg.skippedComponents).toBe(2);
    expect(agg.renderFidelity).toBe(0);
  });
});
