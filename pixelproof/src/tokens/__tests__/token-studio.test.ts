import { describe, it, expect } from 'vitest';
import { parseTokenStudio } from '../converters/token-studio.js';
import { CyclicAliasError } from '../types.js';

describe('Token Studio Converter', () => {
  it('parses nested object with value/type fields', () => {
    const json = {
      colors: {
        primary: { value: '#0050C0', type: 'color' },
      },
    };
    const result = parseTokenStudio(json);

    expect(result.tokens['colors/primary']).toBeDefined();
    expect(result.tokens['colors/primary'].resolvedValue).toBe('#0050c0');
    expect(result.tokens['colors/primary'].type).toBe('color');
  });

  it('resolves dot-notation alias {colors.blue.600} correctly', () => {
    const json = {
      colors: {
        blue: {
          '600': { value: '#0050C0', type: 'color' },
        },
        brand: {
          primary: { value: '{colors.blue.600}', type: 'color' },
        },
      },
    };
    const result = parseTokenStudio(json);

    expect(result.tokens['colors/brand/primary'].resolvedValue).toBe('#0050c0');
    expect(result.tokens['colors/brand/primary'].aliasChain).toEqual([
      'colors/brand/primary',
      'colors/blue/600',
    ]);
  });

  it('resolves multi-level alias chain', () => {
    const json = {
      base: { value: '#ffffff', type: 'color' },
      level1: { value: '{base}', type: 'color' },
      level2: { value: '{level1}', type: 'color' },
    };
    const result = parseTokenStudio(json);

    expect(result.tokens['level2'].resolvedValue).toBe('#ffffff');
    expect(result.tokens['level2'].aliasChain).toEqual(['level2', 'level1', 'base']);
    expect(result.lookupByValue['#ffffff']).toContain('base');
    expect(result.lookupByValue['#ffffff']).toContain('level1');
    expect(result.lookupByValue['#ffffff']).toContain('level2');
  });

  it('throws CyclicAliasError on cyclic reference', () => {
    const json = {
      a: { value: '{b}', type: 'color' },
      b: { value: '{a}', type: 'color' },
    };
    expect(() => parseTokenStudio(json)).toThrow(CyclicAliasError);
  });

  it('maps dimension type to spacing', () => {
    const json = {
      spacing: {
        '4': { value: '16px', type: 'dimension' },
      },
    };
    const result = parseTokenStudio(json);
    expect(result.tokens['spacing/4'].type).toBe('spacing');
  });

  it('builds lookupByValue and lookupByCssVar', () => {
    const json = {
      colors: {
        primary: { value: '#0050C0', type: 'color' },
      },
    };
    const result = parseTokenStudio(json);

    expect(result.lookupByValue['#0050c0']).toContain('colors/primary');
    expect(result.lookupByCssVar['--colors-primary']).toBe('colors/primary');
  });

  it('applies hex normalization', () => {
    const json = {
      colors: {
        white: { value: '#FFF', type: 'color' },
      },
    };
    const result = parseTokenStudio(json);
    expect(result.tokens['colors/white'].resolvedValue).toBe('#ffffff');
  });

  it('sets version, source, and syncedAt', () => {
    const json = { token: { value: '#000', type: 'color' } };
    const result = parseTokenStudio(json, 'test-source');

    expect(result.version).toBe('1');
    expect(result.source).toBe('test-source');
    expect(result.syncedAt).toBeTruthy();
  });

  it('produces identical TokenMap structure as DTCG converter', () => {
    const json = {
      colors: { primary: { value: '#0050C0', type: 'color' } },
    };
    const result = parseTokenStudio(json);

    // Verify all required TokenMap fields exist
    expect(result.version).toBe('1');
    expect(result.tokens).toBeDefined();
    expect(result.lookupByValue).toBeDefined();
    expect(result.lookupByCssVar).toBeDefined();

    // Verify TokenEntry shape
    const entry = result.tokens['colors/primary'];
    expect(entry.resolvedValue).toBe('#0050c0');
    expect(entry.aliasChain).toEqual(['colors/primary']);
    expect(entry.cssVar).toBe('--colors-primary');
    expect(entry.type).toBe('color');
  });
});
