import { describe, it, expect } from 'vitest';
import {
  isViolation,
  findNearestToken,
  normalizeForLookup,
  VALUE_PATTERN,
  isTokenEligibleProp,
  violationTypeFromProp,
  extractValues,
} from '../matchers.js';
import { isWhitelisted } from '../whitelist.js';
import type { TokenMap } from '../../tokens/types.js';

function createTokenMap(lookupByValue: Record<string, string[]> = {}): TokenMap {
  return {
    version: '1',
    syncedAt: new Date().toISOString(),
    source: 'test',
    tokens: {},
    lookupByValue,
    lookupByCssVar: {},
  };
}

describe('Whitelist', () => {
  it.each([
    'transparent', 'inherit', 'currentColor', 'none', 'initial',
    'unset', 'revert', 'auto', '0', '100%', '50%', 'white', 'black', '0px',
  ])('isWhitelisted("%s") returns true', (value) => {
    expect(isWhitelisted(value)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isWhitelisted('Transparent')).toBe(true);
    expect(isWhitelisted('NONE')).toBe(true);
    expect(isWhitelisted('CurrentColor')).toBe(true);
  });

  it('returns false for non-whitelisted values', () => {
    expect(isWhitelisted('#6366f1')).toBe(false);
    expect(isWhitelisted('16px')).toBe(false);
    expect(isWhitelisted('red')).toBe(false);
  });
});

describe('VALUE_PATTERN', () => {
  it.each([
    '#fff', '#6366f1', '#aabbcc', '#FF5733',
    'rgb(99, 102, 241)', 'rgba(0, 0, 0, 0.5)',
    'hsl(120, 100%, 50%)', 'hsla(120, 100%, 50%, 0.5)',
    '16px', '1.5rem', '2em', '0.5em',
  ])('matches raw value "%s"', (value) => {
    expect(VALUE_PATTERN.test(value)).toBe(true);
  });

  it.each([
    'var(--color-primary)', 'transparent', 'inherit', 'none',
    'tokens.primary', 'theme.color', 'auto',
  ])('does not match "%s"', (value) => {
    expect(VALUE_PATTERN.test(value)).toBe(false);
  });
});

describe('normalizeForLookup', () => {
  it('normalizes short hex to 6-digit', () => {
    expect(normalizeForLookup('#fff')).toBe('#ffffff');
    expect(normalizeForLookup('#FFF')).toBe('#ffffff');
    expect(normalizeForLookup('#abc')).toBe('#aabbcc');
  });

  it('lowercases 6-digit hex', () => {
    expect(normalizeForLookup('#FF5733')).toBe('#ff5733');
  });

  it('converts rgb to hex', () => {
    expect(normalizeForLookup('rgb(99, 102, 241)')).toBe('#6366f1');
  });

  it('preserves rgba with alpha < 1', () => {
    expect(normalizeForLookup('rgba(0, 0, 0, 0.5)')).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('converts rgba with alpha = 1 to hex', () => {
    expect(normalizeForLookup('rgba(99, 102, 241, 1)')).toBe('#6366f1');
  });
});

describe('isViolation', () => {
  it('returns true when value is in tokenMap', () => {
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    expect(isViolation('#6366f1', 'color', tokenMap)).toBe(true);
  });

  it('returns false when whitelisted', () => {
    const tokenMap = createTokenMap({ 'transparent': ['colors/transparent'] });
    expect(isViolation('transparent', 'color', tokenMap)).toBe(false);
  });

  it('returns false when value not in tokenMap (precision mode)', () => {
    const tokenMap = createTokenMap({});
    expect(isViolation('#999999', 'color', tokenMap)).toBe(false);
  });

  it('returns false for CSS var()', () => {
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    expect(isViolation('var(--color-primary)', 'color', tokenMap)).toBe(false);
  });

  it('returns true for px value in tokenMap', () => {
    const tokenMap = createTokenMap({ '16px': ['spacing/4'] });
    expect(isViolation('16px', 'fontSize', tokenMap)).toBe(true);
  });

  it('returns false for whitelisted 0', () => {
    const tokenMap = createTokenMap({ '0': ['spacing/0'] });
    expect(isViolation('0', 'margin', tokenMap)).toBe(false);
  });

  it('returns false for calc() expressions', () => {
    const tokenMap = createTokenMap({ '16px': ['spacing/4'] });
    expect(isViolation('calc(100% - 16px)', 'width', tokenMap)).toBe(false);
  });

  it('normalizes #fff to #ffffff for lookup', () => {
    const tokenMap = createTokenMap({ '#ffffff': ['colors/white'] });
    expect(isViolation('#fff', 'color', tokenMap)).toBe(true);
  });

  it('normalizes rgb to hex for lookup', () => {
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    expect(isViolation('rgb(99, 102, 241)', 'color', tokenMap)).toBe(true);
  });
});

describe('findNearestToken', () => {
  it('returns matching token paths', () => {
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary', 'colors/indigo/500'] });
    expect(findNearestToken('#6366f1', tokenMap)).toEqual(['colors/primary', 'colors/indigo/500']);
  });

  it('returns empty array for no match', () => {
    const tokenMap = createTokenMap({});
    expect(findNearestToken('#999', tokenMap)).toEqual([]);
  });
});

describe('isTokenEligibleProp', () => {
  it.each(['color', 'backgroundColor', 'fontSize', 'margin', 'borderRadius', 'boxShadow'])(
    'returns true for "%s"', (prop) => {
      expect(isTokenEligibleProp(prop)).toBe(true);
    },
  );

  it.each(['background-color', 'font-size', 'border-radius', 'box-shadow'])(
    'returns true for kebab "%s"', (prop) => {
      expect(isTokenEligibleProp(prop)).toBe(true);
    },
  );

  it('returns false for non-eligible props', () => {
    expect(isTokenEligibleProp('display')).toBe(false);
    expect(isTokenEligibleProp('position')).toBe(false);
  });
});

describe('violationTypeFromProp', () => {
  it('maps color props to color', () => {
    expect(violationTypeFromProp('color')).toBe('color');
    expect(violationTypeFromProp('backgroundColor')).toBe('color');
  });

  it('maps font props to typography', () => {
    expect(violationTypeFromProp('fontSize')).toBe('typography');
    expect(violationTypeFromProp('fontFamily')).toBe('typography');
  });

  it('maps radius props to border-radius', () => {
    expect(violationTypeFromProp('borderRadius')).toBe('border-radius');
  });

  it('maps shadow props to shadow', () => {
    expect(violationTypeFromProp('boxShadow')).toBe('shadow');
  });

  it('defaults to spacing', () => {
    expect(violationTypeFromProp('margin')).toBe('spacing');
    expect(violationTypeFromProp('padding')).toBe('spacing');
  });
});

describe('extractValues', () => {
  it('splits space-separated values', () => {
    expect(extractValues('1px solid #6366f1')).toEqual(['1px', 'solid', '#6366f1']);
  });

  it('keeps rgb() together', () => {
    expect(extractValues('1px solid rgb(99, 102, 241)')).toEqual([
      '1px', 'solid', 'rgb(99, 102, 241)',
    ]);
  });

  it('returns single value as array', () => {
    expect(extractValues('#6366f1')).toEqual(['#6366f1']);
  });
});
