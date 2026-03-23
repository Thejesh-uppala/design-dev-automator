import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import { scanVanillaExtract } from '../engines/vanilla-extract.js';
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

function parseCode(code: string) {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

describe('vanilla-extract Engine', () => {
  it('detects violation in style()', () => {
    const code = `const cls = style({ color: '#6366f1' });`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanVanillaExtract(parseCode(code), 'theme.css.ts', tokenMap);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].source).toBe('vanilla-extract');
  });

  it('detects violation in globalStyle()', () => {
    const code = `globalStyle('.root', { background: '#6366f1' });`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanVanillaExtract(parseCode(code), 'theme.css.ts', tokenMap);
    expect(result.violations).toHaveLength(1);
  });

  it('detects violations in recipe() base + variants', () => {
    const code = `
      const btn = recipe({
        base: { color: '#6366f1' },
        variants: {
          size: {
            lg: { fontSize: '20px' }
          }
        }
      });
    `;
    const tokenMap = createTokenMap({
      '#6366f1': ['colors/primary'],
      '20px': ['typography/lg'],
    });
    const result = scanVanillaExtract(parseCode(code), 'theme.css.ts', tokenMap);
    expect(result.violations).toHaveLength(2);
  });

  it('detects violation in styleVariants()', () => {
    const code = `const variants = styleVariants({ primary: { color: '#6366f1' } });`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanVanillaExtract(parseCode(code), 'theme.css.ts', tokenMap);
    expect(result.violations).toHaveLength(1);
  });

  it('skips variable references', () => {
    const code = `const cls = style({ color: vars.primary });`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanVanillaExtract(parseCode(code), 'theme.css.ts', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('detects violation in nested selector object', () => {
    const code = `const cls = style({ selectors: { '&:hover': { color: '#6366f1' } } });`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanVanillaExtract(parseCode(code), 'theme.css.ts', tokenMap);
    expect(result.violations).toHaveLength(1);
  });

  it('returns empty for non-.css.ts files', () => {
    const code = `const cls = style({ color: '#6366f1' });`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanVanillaExtract(parseCode(code), 'theme.ts', tokenMap);
    expect(result.violations).toHaveLength(0);
  });
});
