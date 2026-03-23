import { describe, it, expect } from 'vitest';
import { detectTokenFormat } from '../converters/detect.js';

describe('Token Format Detection', () => {
  it('detects .css file as style-dictionary-css', () => {
    expect(detectTokenFormat('tokens.css', ':root { --x: #000; }')).toBe(
      'style-dictionary-css',
    );
  });

  it('detects .js file as style-dictionary-js', () => {
    expect(
      detectTokenFormat('tokens.js', 'module.exports = { color: {} }'),
    ).toBe('style-dictionary-js');
  });

  it('detects .ts file as style-dictionary-js', () => {
    expect(
      detectTokenFormat('tokens.ts', 'export default { color: {} }'),
    ).toBe('style-dictionary-js');
  });

  it('detects .json with "$value" as dtcg', () => {
    const content = JSON.stringify({
      colors: { primary: { $value: '#0050C0', $type: 'color' } },
    });
    expect(detectTokenFormat('tokens.json', content)).toBe('dtcg');
  });

  it('detects .json with "value" (no $) as token-studio', () => {
    const content = JSON.stringify({
      colors: { primary: { value: '#0050C0', type: 'color' } },
    });
    expect(detectTokenFormat('design-tokens.json', content)).toBe(
      'token-studio',
    );
  });

  it('returns unknown for unrecognized format', () => {
    expect(detectTokenFormat('readme.md', '# Tokens')).toBe('unknown');
  });

  it('returns unknown for .json without value fields', () => {
    expect(detectTokenFormat('package.json', '{"name": "foo"}')).toBe(
      'unknown',
    );
  });
});
