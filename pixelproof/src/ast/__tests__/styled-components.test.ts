import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import { scanStyledComponents } from '../engines/styled-components.js';
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

describe('styled-components Engine', () => {
  it('detects violation in styled.button`color: #6366f1;`', () => {
    const code = 'const Button = styled.button`color: #6366f1;`;';
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanStyledComponents(parseCode(code), 'Button.tsx', tokenMap);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].prop).toBe('color');
    expect(result.violations[0].source).toBe('styled-components');
  });

  it('skips dynamic interpolation', () => {
    const code = 'const Button = styled.button`color: ${props => props.color};`;';
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanStyledComponents(parseCode(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('does not flag whitelisted transparent', () => {
    const code = 'const Button = styled.button`background: transparent;`;';
    const tokenMap = createTokenMap({});
    const result = scanStyledComponents(parseCode(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(0);
  });

  it('detects multiple violations', () => {
    const code = 'const Button = styled.button`margin: 16px; color: #6366f1;`;';
    const tokenMap = createTokenMap({
      '16px': ['spacing/4'],
      '#6366f1': ['colors/primary'],
    });
    const result = scanStyledComponents(parseCode(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(2);
  });

  it('detects violation in css tagged template', () => {
    const code = 'const styles = css`font-size: 14px;`;';
    const tokenMap = createTokenMap({ '14px': ['typography/sm'] });
    const result = scanStyledComponents(parseCode(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(1);
  });

  it('detects violation in styled(Component)', () => {
    const code = 'const Button = styled(BaseButton)`color: #6366f1;`;';
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanStyledComponents(parseCode(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(1);
  });

  it('handles mixed static and dynamic', () => {
    const code = 'const Button = styled.button`color: ${theme.primary}; border: 1px solid #6366f1;`;';
    const tokenMap = createTokenMap({ '#6366f1': ['colors/primary'] });
    const result = scanStyledComponents(parseCode(code), 'Button.tsx', tokenMap);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].found).toBe('#6366f1');
  });
});
