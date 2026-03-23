import { describe, it, expect, beforeEach } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLocalTokens } from '../loader.js';
import type { TokensConfig } from '../../config/schema.js';

const defaultTokensConfig: TokensConfig = {
  format: 'dtcg',
  fallbackDir: 'tokens/',
};

describe('loadLocalTokens', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'pixelproof-loader-test-'));
  });

  it('merges DTCG JSON + SD CSS files into single TokenMap', () => {
    const tokensDir = join(rootDir, 'tokens');
    mkdirSync(tokensDir);

    // DTCG JSON file
    const dtcgJson = {
      colors: {
        primary: { $value: '#0050C0', $type: 'color' },
      },
    };
    writeFileSync(
      join(tokensDir, 'colors.json'),
      JSON.stringify(dtcgJson),
      'utf-8',
    );

    // SD CSS file
    const css = ':root { --spacing-4: 16px; }';
    writeFileSync(join(tokensDir, 'spacing.css'), css, 'utf-8');

    const result = loadLocalTokens(rootDir, defaultTokensConfig);

    // DTCG tokens present
    expect(result.tokens['colors/primary']).toBeDefined();
    expect(result.tokens['colors/primary'].resolvedValue).toBe('#0050c0');

    // SD CSS tokens present
    expect(result.tokens['spacing-4']).toBeDefined();
    expect(result.tokens['spacing-4'].resolvedValue).toBe('16px');

    // Both in lookup maps
    expect(result.lookupByValue['#0050c0']).toContain('colors/primary');
    expect(result.lookupByValue['16px']).toContain('spacing-4');
  });

  it('returns empty TokenMap when tokens directory does not exist', () => {
    const result = loadLocalTokens(rootDir, defaultTokensConfig);

    expect(Object.keys(result.tokens)).toHaveLength(0);
    expect(result.version).toBe('1');
    expect(result.source).toBe('local');
  });

  it('returns empty TokenMap for empty tokens directory', () => {
    const tokensDir = join(rootDir, 'tokens');
    mkdirSync(tokensDir);

    const result = loadLocalTokens(rootDir, defaultTokensConfig);

    expect(Object.keys(result.tokens)).toHaveLength(0);
  });

  it('creates .pixelproof/ directory automatically', () => {
    const tokensDir = join(rootDir, 'tokens');
    mkdirSync(tokensDir);

    loadLocalTokens(rootDir, defaultTokensConfig);

    expect(existsSync(join(rootDir, '.pixelproof'))).toBe(true);
  });

  it('writes token-cache.json to .pixelproof/', () => {
    const tokensDir = join(rootDir, 'tokens');
    mkdirSync(tokensDir);
    writeFileSync(
      join(tokensDir, 'colors.json'),
      JSON.stringify({ c: { $value: '#000', $type: 'color' } }),
      'utf-8',
    );

    loadLocalTokens(rootDir, defaultTokensConfig);

    const cachePath = join(rootDir, '.pixelproof', 'token-cache.json');
    expect(existsSync(cachePath)).toBe(true);
    const cached = JSON.parse(readFileSync(cachePath, 'utf-8'));
    expect(cached.tokens['c']).toBeDefined();
  });

  it('creates .gitignore with .pixelproof/ when missing', () => {
    const tokensDir = join(rootDir, 'tokens');
    mkdirSync(tokensDir);

    loadLocalTokens(rootDir, defaultTokensConfig);

    const gitignorePath = join(rootDir, '.gitignore');
    expect(existsSync(gitignorePath)).toBe(true);
    const content = readFileSync(gitignorePath, 'utf-8');
    expect(content).toContain('.pixelproof/');
  });

  it('appends .pixelproof/ to existing .gitignore', () => {
    writeFileSync(join(rootDir, '.gitignore'), 'node_modules/\n', 'utf-8');
    const tokensDir = join(rootDir, 'tokens');
    mkdirSync(tokensDir);

    loadLocalTokens(rootDir, defaultTokensConfig);

    const content = readFileSync(join(rootDir, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.pixelproof/');
  });

  it('does not duplicate .pixelproof/ in .gitignore', () => {
    writeFileSync(
      join(rootDir, '.gitignore'),
      'node_modules/\n.pixelproof/\n',
      'utf-8',
    );
    const tokensDir = join(rootDir, 'tokens');
    mkdirSync(tokensDir);

    loadLocalTokens(rootDir, defaultTokensConfig);

    const content = readFileSync(join(rootDir, '.gitignore'), 'utf-8');
    const matches = content.match(/\.pixelproof\//g) || [];
    expect(matches).toHaveLength(1);
  });

  it('skips files with unknown format', () => {
    const tokensDir = join(rootDir, 'tokens');
    mkdirSync(tokensDir);
    writeFileSync(join(tokensDir, 'readme.md'), '# Tokens', 'utf-8');
    writeFileSync(
      join(tokensDir, 'colors.json'),
      JSON.stringify({ c: { $value: '#000', $type: 'color' } }),
      'utf-8',
    );

    const result = loadLocalTokens(rootDir, defaultTokensConfig);

    // Only JSON token should be present, md file skipped
    expect(Object.keys(result.tokens)).toHaveLength(1);
  });

  it('uses custom fallbackDir from config', () => {
    const customDir = join(rootDir, 'design-tokens');
    mkdirSync(customDir);
    writeFileSync(
      join(customDir, 'colors.json'),
      JSON.stringify({ c: { $value: '#fff', $type: 'color' } }),
      'utf-8',
    );

    const config: TokensConfig = {
      format: 'dtcg',
      fallbackDir: 'design-tokens/',
    };
    const result = loadLocalTokens(rootDir, config);

    expect(result.tokens['c']).toBeDefined();
    expect(result.tokens['c'].resolvedValue).toBe('#ffffff');
  });
});
