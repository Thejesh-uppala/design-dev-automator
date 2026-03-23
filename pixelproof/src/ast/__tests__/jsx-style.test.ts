import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import { scanJSXStyles } from '../engines/jsx-style.js';
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

function parseJSX(code: string) {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

describe('JSX Style Prop Engine', () => {
  it('detects violation in style={{ color: "#6366f1" }}', () => {
    const code = `<div style={{ color: '#6366f1' }} />`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const ast = parseJSX(code);
    const result = scanJSXStyles(ast, 'Button.tsx', tokenMap);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].prop).toBe('color');
    expect(result.violations[0].found).toBe('#6366f1');
    expect(result.violations[0].source).toBe('jsx-style');
  });

  it('returns 0 violations for whitelisted value', () => {
    const code = `<div style={{ color: 'transparent' }} />`;
    const tokenMap = createTokenMap({ 'transparent': ['colors/transparent'] });
    const result = scanJSXStyles(parseJSX(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('skips dynamic references', () => {
    const code = `<div style={{ color: tokens.primary }} />`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanJSXStyles(parseJSX(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('detects multiple violations', () => {
    const code = `<div style={{ color: '#6366f1', fontSize: '16px' }} />`;
    const tokenMap = createTokenMap({
      '#6366f1': ['colors/primary'],
      '16px': ['spacing/4'],
    });
    const result = scanJSXStyles(parseJSX(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(2);
  });

  it('skips conditional expressions', () => {
    const code = `<div style={{ color: isActive ? '#6366f1' : '#ccc' }} />`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanJSXStyles(parseJSX(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('returns 0 violations for precision mode (value not in tokenMap)', () => {
    const code = `<div style={{ color: '#999' }} />`;
    const tokenMap = createTokenMap({});
    const result = scanJSXStyles(parseJSX(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('ignores spread elements', () => {
    const code = `<div style={{ ...baseStyles, color: '#6366f1' }} />`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanJSXStyles(parseJSX(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].prop).toBe('color');
  });

  it('whitelists margin: 0', () => {
    const code = `<div style={{ margin: 0 }} />`;
    const tokenMap = createTokenMap({ '0': ['spacing/0'] });
    const result = scanJSXStyles(parseJSX(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('detects numeric value on spacing prop (appends px)', () => {
    const code = `<div style={{ margin: 16 }} />`;
    const tokenMap = createTokenMap({ '16px': ['spacing/4'] });
    const result = scanJSXStyles(parseJSX(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].found).toBe('16px');
  });

  it('counts totalProperties correctly', () => {
    const code = `<div style={{ color: '#6366f1', display: 'flex' }} />`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanJSXStyles(parseJSX(code), 'Button.tsx', tokenMap);
    // Only 'color' is token-eligible, not 'display'
    expect(result.totalProperties).toBe(1);
  });
});
