import { describe, it, expect } from 'vitest';
import { scanFile } from '../scanner.js';
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

describe('AST Scanner', () => {
  it('dispatches .tsx file to JSX engine', () => {
    const source = `export const Button = () => <div style={{ color: '#6366f1' }} />;`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanFile('Button.tsx', source, tokenMap);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].source).toBe('jsx-style');
  });

  it('dispatches .module.css to CSS Modules engine', () => {
    const source = `.btn { color: #6366f1; }`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanFile('Button.module.css', source, tokenMap);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].source).toBe('css-module');
  });

  it('dispatches .css.ts to vanilla-extract engine', () => {
    const source = `const cls = style({ color: '#6366f1' });`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanFile('theme.css.ts', source, tokenMap);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].source).toBe('vanilla-extract');
  });

  it('runs styled-components engine when import detected', () => {
    const source = `
      import styled from 'styled-components';
      const Button = styled.button\`color: #6366f1;\`;
    `;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanFile('Button.tsx', source, tokenMap);
    expect(result.violations.some((v) => v.source === 'styled-components')).toBe(true);
  });

  it('runs Emotion engine when @emotion import detected', () => {
    const source = `
      import { css } from '@emotion/react';
      const styles = css({ color: '#6366f1' });
    `;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanFile('Card.tsx', source, tokenMap);
    expect(result.violations.some((v) => v.source === 'emotion')).toBe(true);
  });

  it('returns 0 violations for utils.ts with no styles', () => {
    const source = `export function add(a: number, b: number) { return a + b; }`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanFile('utils.ts', source, tokenMap);
    expect(result.violations).toHaveLength(0);
  });
});
