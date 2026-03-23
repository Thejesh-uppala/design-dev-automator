import { describe, it, expect } from 'vitest';
import { parseHash } from '../router.js';

describe('parseHash', () => {
  it('returns overview for empty hash', () => {
    expect(parseHash('')).toEqual({ route: 'overview', params: {} });
  });

  it('returns overview for #/', () => {
    expect(parseHash('#/')).toEqual({ route: 'overview', params: {} });
  });

  it('returns overview for #', () => {
    expect(parseHash('#')).toEqual({ route: 'overview', params: {} });
  });

  it('returns tokens route', () => {
    expect(parseHash('#/tokens')).toEqual({ route: 'tokens', params: {} });
    expect(parseHash('#tokens')).toEqual({ route: 'tokens', params: {} });
  });

  it('returns component route with file param', () => {
    expect(parseHash('#/component/src/Button.tsx')).toEqual({
      route: 'component',
      params: { file: 'src/Button.tsx' },
    });
  });

  it('decodes URI-encoded file param', () => {
    expect(
      parseHash('#/component/src%2Fcomponents%2FButton.tsx'),
    ).toEqual({
      route: 'component',
      params: { file: 'src/components/Button.tsx' },
    });
  });

  it('returns overview for unknown route', () => {
    expect(parseHash('#/unknown')).toEqual({
      route: 'overview',
      params: {},
    });
  });
});
