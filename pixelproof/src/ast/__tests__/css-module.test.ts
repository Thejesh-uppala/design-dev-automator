import { describe, it, expect } from 'vitest';
import { scanCSSModule } from '../engines/css-module.js';
import type { TokenMap } from '../../tokens/types.js';

function createTokenMap(lookupByValue: Record<string, string[]> = {}): TokenMap {
  const tokens: TokenMap['tokens'] = {};
  for (const [value, paths] of Object.entries(lookupByValue)) {
    for (const path of paths) {
      tokens[path] = {
        resolvedValue: value,
        aliasChain: [path],
        cssVar: `--${path.replace(/\//g, '-')}`,
        type: 'color',
      };
    }
  }
  return {
    version: '1',
    syncedAt: new Date().toISOString(),
    source: 'test',
    tokens,
    lookupByValue,
    lookupByCssVar: {},
  };
}

describe('CSS Modules Engine', () => {
  it('detects violation in .btn { color: #6366f1; }', () => {
    const css = `.btn { color: #6366f1; }`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanCSSModule(css, 'Button.module.css', tokenMap);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].prop).toBe('color');
    expect(result.violations[0].found).toBe('#6366f1');
    expect(result.violations[0].source).toBe('css-module');
  });

  it('does not flag var(--color-primary)', () => {
    const css = `.btn { color: var(--color-primary); }`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanCSSModule(css, 'Button.module.css', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('does not flag SCSS variable reference', () => {
    const css = `.btn { color: $primary; }`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanCSSModule(css, 'Button.module.scss', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('detects violation in multi-value border declaration', () => {
    const css = `.btn { border: 1px solid #6366f1; }`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanCSSModule(css, 'Button.module.css', tokenMap);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].found).toBe('#6366f1');
  });

  it('does not flag whitelisted margin: 0', () => {
    const css = `.btn { margin: 0; }`;
    const tokenMap = createTokenMap({});
    const result = scanCSSModule(css, 'Button.module.css', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('does not flag background: transparent', () => {
    const css = `.btn { background: transparent; }`;
    const tokenMap = createTokenMap({});
    const result = scanCSSModule(css, 'Button.module.css', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('detects font-size violation', () => {
    const css = `.btn { font-size: 16px; }`;
    const tokenMap = createTokenMap({ '16px': ['spacing/4'] });
    const result = scanCSSModule(css, 'Button.module.css', tokenMap);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].prop).toBe('font-size');
  });

  it('returns 0 violations in precision mode', () => {
    const css = `.btn { color: #999; }`;
    const tokenMap = createTokenMap({});
    const result = scanCSSModule(css, 'Button.module.css', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('skips non-token-eligible properties', () => {
    const css = `.btn { display: flex; position: relative; }`;
    const tokenMap = createTokenMap({});
    const result = scanCSSModule(css, 'Button.module.css', tokenMap);
    expect(result.totalProperties).toBe(0);
  });
});
