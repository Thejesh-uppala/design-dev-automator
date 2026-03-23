import { describe, it, expect } from 'vitest';
import {
  parseStyleDictionaryCSS,
  parseStyleDictionaryJS,
  inferTypeFromValue,
} from '../converters/style-dictionary.js';

describe('Style Dictionary CSS Converter', () => {
  it('parses :root CSS custom properties', () => {
    const css = `:root {
      --color-primary: #0050C0;
      --spacing-4: 16px;
    }`;
    const result = parseStyleDictionaryCSS(css);

    expect(result.tokens['color-primary']).toBeDefined();
    expect(result.tokens['color-primary'].resolvedValue).toBe('#0050c0');
    expect(result.tokens['spacing-4']).toBeDefined();
    expect(result.tokens['spacing-4'].resolvedValue).toBe('16px');
  });

  it('populates lookupByValue correctly', () => {
    const css = `:root {
      --color-primary: #0050C0;
      --color-secondary: #6B7280;
    }`;
    const result = parseStyleDictionaryCSS(css);

    expect(result.lookupByValue['#0050c0']).toContain('color-primary');
    expect(result.lookupByValue['#6b7280']).toContain('color-secondary');
  });

  it('populates lookupByCssVar correctly', () => {
    const css = `:root { --color-primary: #0050C0; }`;
    const result = parseStyleDictionaryCSS(css);

    expect(result.lookupByCssVar['--color-primary']).toBe('color-primary');
  });

  it('applies hex normalization', () => {
    const css = `:root { --color-white: #FFF; --color-black: #000000; }`;
    const result = parseStyleDictionaryCSS(css);

    expect(result.tokens['color-white'].resolvedValue).toBe('#ffffff');
    expect(result.tokens['color-black'].resolvedValue).toBe('#000000');
  });

  it('infers type from value — hex → color, px → spacing', () => {
    const css = `:root {
      --color-primary: #0050C0;
      --spacing-4: 16px;
      --spacing-half: 0.5rem;
    }`;
    const result = parseStyleDictionaryCSS(css);

    expect(result.tokens['color-primary'].type).toBe('color');
    expect(result.tokens['spacing-4'].type).toBe('spacing');
    expect(result.tokens['spacing-half'].type).toBe('spacing');
  });

  it('sets alias chain to single element (no aliases in CSS)', () => {
    const css = `:root { --color-primary: #0050C0; }`;
    const result = parseStyleDictionaryCSS(css);

    expect(result.tokens['color-primary'].aliasChain).toEqual(['color-primary']);
  });

  it('sets version, source, and syncedAt', () => {
    const css = `:root { --x: #000; }`;
    const result = parseStyleDictionaryCSS(css, 'test-source');

    expect(result.version).toBe('1');
    expect(result.source).toBe('test-source');
    expect(result.syncedAt).toBeTruthy();
  });
});

describe('Style Dictionary JS Converter', () => {
  it('parses nested object with value fields', () => {
    const obj = {
      color: {
        primary: { value: '#0050C0' },
        secondary: { value: '#6B7280' },
      },
    };
    const result = parseStyleDictionaryJS(obj);

    expect(result.tokens['color/primary']).toBeDefined();
    expect(result.tokens['color/primary'].resolvedValue).toBe('#0050c0');
    expect(result.tokens['color/secondary'].resolvedValue).toBe('#6b7280');
  });

  it('flattens to correct token paths', () => {
    const obj = {
      color: {
        brand: {
          primary: { value: '#0050C0' },
        },
      },
    };
    const result = parseStyleDictionaryJS(obj);

    expect(result.tokens['color/brand/primary']).toBeDefined();
    expect(result.tokens['color/brand/primary'].cssVar).toBe('--color-brand-primary');
  });

  it('produces identical TokenMap structure as other converters', () => {
    const obj = {
      color: { primary: { value: '#0050C0' } },
    };
    const result = parseStyleDictionaryJS(obj);

    // Verify all required TokenMap fields exist
    expect(result.version).toBe('1');
    expect(result.syncedAt).toBeTruthy();
    expect(result.source).toBe('style-dictionary-js');
    expect(result.tokens).toBeDefined();
    expect(result.lookupByValue).toBeDefined();
    expect(result.lookupByCssVar).toBeDefined();

    // Verify TokenEntry shape
    const entry = result.tokens['color/primary'];
    expect(entry.resolvedValue).toBe('#0050c0');
    expect(entry.aliasChain).toEqual(['color/primary']);
    expect(entry.cssVar).toBe('--color-primary');
    expect(entry.type).toBe('color');

    // Verify lookup maps
    expect(result.lookupByValue['#0050c0']).toContain('color/primary');
    expect(result.lookupByCssVar['--color-primary']).toBe('color/primary');
  });

  it('applies hex normalization', () => {
    const obj = { color: { white: { value: '#FFF' } } };
    const result = parseStyleDictionaryJS(obj);

    expect(result.tokens['color/white'].resolvedValue).toBe('#ffffff');
  });

  it('infers type from value', () => {
    const obj = {
      color: { primary: { value: '#0050C0' } },
      spacing: { '4': { value: '16px' } },
    };
    const result = parseStyleDictionaryJS(obj);

    expect(result.tokens['color/primary'].type).toBe('color');
    expect(result.tokens['spacing/4'].type).toBe('spacing');
  });
});

describe('inferTypeFromValue', () => {
  it('hex → color', () => {
    expect(inferTypeFromValue('#fff')).toBe('color');
    expect(inferTypeFromValue('#0050C0')).toBe('color');
  });

  it('rgb/hsl → color', () => {
    expect(inferTypeFromValue('rgb(0,0,0)')).toBe('color');
    expect(inferTypeFromValue('hsl(200,50%,50%)')).toBe('color');
  });

  it('px/rem/em → spacing', () => {
    expect(inferTypeFromValue('16px')).toBe('spacing');
    expect(inferTypeFromValue('1.5rem')).toBe('spacing');
    expect(inferTypeFromValue('2em')).toBe('spacing');
  });

  it('unknown → color (fallback)', () => {
    expect(inferTypeFromValue('bold')).toBe('color');
    expect(inferTypeFromValue('Inter')).toBe('color');
  });
});
