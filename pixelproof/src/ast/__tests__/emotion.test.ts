import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import { scanEmotion } from '../engines/emotion.js';
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

describe('Emotion Engine', () => {
  it('detects violation in css={{ color: "#6366f1" }}', () => {
    const code = `<div css={{ color: '#6366f1' }} />`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanEmotion(parseCode(code), 'Card.tsx', tokenMap);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].source).toBe('emotion');
    expect(result.violations[0].prop).toBe('color');
  });

  it('detects violation in css() call with object', () => {
    const code = `const styles = css({ fontSize: '16px' });`;
    const tokenMap = createTokenMap({ '16px': ['spacing/4'] });
    const result = scanEmotion(parseCode(code), 'Card.tsx', tokenMap);

    expect(result.violations).toHaveLength(1);
  });

  it('skips dynamic references in css prop', () => {
    const code = `<div css={{ color: theme.primary }} />`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanEmotion(parseCode(code), 'Card.tsx', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('does not process style prop (JSX engine handles that)', () => {
    const code = `<div style={{ color: '#6366f1' }} />`;
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanEmotion(parseCode(code), 'Card.tsx', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('detects violation in css prop template literal', () => {
    const code = '<div css={css`color: #6366f1;`} />';
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanEmotion(parseCode(code), 'Card.tsx', tokenMap);
    expect(result.violations).toHaveLength(1);
  });
});
