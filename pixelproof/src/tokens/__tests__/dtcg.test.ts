import { describe, it, expect } from 'vitest';
import { parseDTCG, normalizeValue, pathToCssVar } from '../converters/dtcg.js';
import { resolveAliasChain } from '../resolver.js';
import { CyclicAliasError, MaxDepthError } from '../types.js';

describe('DTCG Converter', () => {
  it('parses simple token and populates lookupByValue', () => {
    const json = {
      colors: {
        primary: { $value: '#0050C0', $type: 'color' },
      },
    };
    const result = parseDTCG(json);

    expect(result.tokens['colors/primary']).toBeDefined();
    expect(result.tokens['colors/primary'].resolvedValue).toBe('#0050c0');
    expect(result.tokens['colors/primary'].type).toBe('color');
    expect(result.lookupByValue['#0050c0']).toContain('colors/primary');
  });

  it('resolves 2-level alias chain', () => {
    const json = {
      colors: {
        blue: {
          '600': { $value: '#0050C0', $type: 'color' },
        },
        brand: {
          primary: { $value: '{colors/blue/600}', $type: 'color' },
        },
      },
    };
    const result = parseDTCG(json);

    expect(result.tokens['colors/brand/primary'].resolvedValue).toBe('#0050c0');
    expect(result.tokens['colors/brand/primary'].aliasChain).toEqual([
      'colors/brand/primary',
      'colors/blue/600',
    ]);
    expect(result.lookupByValue['#0050c0']).toContain('colors/brand/primary');
    expect(result.lookupByValue['#0050c0']).toContain('colors/blue/600');
  });

  it('resolves 4-level alias chain — all tokens map to same value', () => {
    const json = {
      base: { $value: '#ffffff', $type: 'color' },
      level1: { $value: '{base}', $type: 'color' },
      level2: { $value: '{level1}', $type: 'color' },
      level3: { $value: '{level2}', $type: 'color' },
    };
    const result = parseDTCG(json);

    expect(result.tokens['level3'].resolvedValue).toBe('#ffffff');
    expect(result.tokens['level3'].aliasChain).toEqual(['level3', 'level2', 'level1', 'base']);
    expect(result.lookupByValue['#ffffff']).toContain('base');
    expect(result.lookupByValue['#ffffff']).toContain('level1');
    expect(result.lookupByValue['#ffffff']).toContain('level2');
    expect(result.lookupByValue['#ffffff']).toContain('level3');
  });

  it('throws CyclicAliasError on cyclic reference', () => {
    const json = {
      a: { $value: '{b}', $type: 'color' },
      b: { $value: '{a}', $type: 'color' },
    };
    expect(() => parseDTCG(json)).toThrow(CyclicAliasError);
    try {
      parseDTCG(json);
    } catch (e) {
      expect((e as CyclicAliasError).chain).toEqual(['a', 'b', 'a']);
    }
  });

  it('throws MaxDepthError on chain exceeding 20 levels', () => {
    // Build a 21-level chain
    const json: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < 21; i++) {
      json[`token${i}`] = {
        $value: i === 0 ? '#000000' : `{token${i - 1}}`,
        $type: 'color',
      };
    }
    // token20 → token19 → ... → token0 = 21 levels
    expect(() => parseDTCG(json)).toThrow(MaxDepthError);
  });

  it('maps $type "dimension" to internal type "spacing"', () => {
    const json = {
      spacing: {
        '4': { $value: '16px', $type: 'dimension' },
      },
    };
    const result = parseDTCG(json);
    expect(result.tokens['spacing/4'].type).toBe('spacing');
    expect(result.lookupByValue['16px']).toContain('spacing/4');
  });

  it('normalizes hex values: #fff → #ffffff, uppercase → lowercase', () => {
    expect(normalizeValue('#fff')).toBe('#ffffff');
    expect(normalizeValue('#FFF')).toBe('#ffffff');
    expect(normalizeValue('#0050C0')).toBe('#0050c0');
    expect(normalizeValue('16px')).toBe('16px');
    expect(normalizeValue('rgb(0,0,0)')).toBe('rgb(0,0,0)');
  });

  it('derives CSS variable from token path', () => {
    expect(pathToCssVar('colors/brand/primary')).toBe('--colors-brand-primary');
    expect(pathToCssVar('spacing/4')).toBe('--spacing-4');
  });

  it('populates lookupByCssVar correctly', () => {
    const json = {
      colors: {
        brand: {
          primary: { $value: '#0050C0', $type: 'color' },
        },
      },
    };
    const result = parseDTCG(json);
    expect(result.lookupByCssVar['--colors-brand-primary']).toBe('colors/brand/primary');
  });

  it('sets version, source, and syncedAt', () => {
    const json = { token: { $value: '#000', $type: 'color' } };
    const result = parseDTCG(json, 'test-source');
    expect(result.version).toBe('1');
    expect(result.source).toBe('test-source');
    expect(result.syncedAt).toBeTruthy();
  });
});

describe('resolveAliasChain', () => {
  it('resolves direct value (no alias)', () => {
    const tokens = { a: { $value: '#000000' } };
    const result = resolveAliasChain('a', tokens);
    expect(result.value).toBe('#000000');
    expect(result.chain).toEqual(['a']);
  });

  it('resolves single alias', () => {
    const tokens = {
      a: { $value: '{b}' },
      b: { $value: '#ffffff' },
    };
    const result = resolveAliasChain('a', tokens);
    expect(result.value).toBe('#ffffff');
    expect(result.chain).toEqual(['a', 'b']);
  });

  it('throws on missing token reference', () => {
    const tokens = { a: { $value: '{missing}' } };
    expect(() => resolveAliasChain('a', tokens)).toThrow('Token not found: missing');
  });
});
