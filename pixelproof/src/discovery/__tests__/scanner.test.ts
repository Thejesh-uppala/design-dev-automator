import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverComponents } from '../scanner.js';
import type { ScanConfig } from '../../config/schema.js';

const defaultScanConfig: ScanConfig = {
  include: ['src/**'],
  exclude: ['**/*.test.tsx', '**/*.stories.tsx', '**/node_modules/**'],
  fileTypes: ['tsx', 'ts', 'jsx', 'js', 'css', 'scss'],
};

describe('discoverComponents', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'pixelproof-scanner-test-'));
    mkdirSync(join(rootDir, 'src', 'components'), { recursive: true });
  });

  it('discovers exported React components', () => {
    writeFileSync(
      join(rootDir, 'src', 'components', 'Button.tsx'),
      `export function Button() { return <button>Click</button>; }`,
      'utf-8',
    );

    const result = discoverComponents(rootDir, defaultScanConfig);

    expect(result).toHaveLength(1);
    expect(result[0].file).toContain('Button.tsx');
    expect(result[0].exports).toEqual(['Button']);
  });

  it('respects scan.exclude — skips test files', () => {
    writeFileSync(
      join(rootDir, 'src', 'components', 'Button.tsx'),
      `export function Button() { return <button />; }`,
      'utf-8',
    );
    writeFileSync(
      join(rootDir, 'src', 'components', 'Button.test.tsx'),
      `export function test() { return <div />; }`,
      'utf-8',
    );

    const result = discoverComponents(rootDir, defaultScanConfig);

    expect(result).toHaveLength(1);
    expect(result[0].file).toContain('Button.tsx');
    expect(result[0].file).not.toContain('.test.');
  });

  it('includes CSS files with empty exports', () => {
    writeFileSync(
      join(rootDir, 'src', 'components', 'styles.css'),
      `.button { color: red; }`,
      'utf-8',
    );

    const result = discoverComponents(rootDir, defaultScanConfig);

    expect(result).toHaveLength(1);
    expect(result[0].file).toContain('styles.css');
    expect(result[0].exports).toEqual([]);
  });

  it('includes SCSS files with empty exports', () => {
    writeFileSync(
      join(rootDir, 'src', 'components', 'styles.scss'),
      `$primary: #000; .button { color: $primary; }`,
      'utf-8',
    );

    const result = discoverComponents(rootDir, defaultScanConfig);

    expect(result).toHaveLength(1);
    expect(result[0].exports).toEqual([]);
  });

  it('filters by fileTypes — ignores unlisted extensions', () => {
    writeFileSync(
      join(rootDir, 'src', 'components', 'readme.md'),
      `# Component docs`,
      'utf-8',
    );
    writeFileSync(
      join(rootDir, 'src', 'components', 'Button.tsx'),
      `export function Button() { return <button />; }`,
      'utf-8',
    );

    const result = discoverComponents(rootDir, defaultScanConfig);

    expect(result).toHaveLength(1);
    expect(result[0].file).toContain('Button.tsx');
  });

  it('handles files with no component exports', () => {
    writeFileSync(
      join(rootDir, 'src', 'components', 'utils.ts'),
      `export function add(a: number, b: number) { return a + b; }`,
      'utf-8',
    );

    const result = discoverComponents(rootDir, defaultScanConfig);

    expect(result).toHaveLength(1);
    expect(result[0].exports).toEqual([]);
  });

  it('discovers multiple files in nested directories', () => {
    mkdirSync(join(rootDir, 'src', 'features', 'auth'), { recursive: true });

    writeFileSync(
      join(rootDir, 'src', 'components', 'Button.tsx'),
      `export function Button() { return <button />; }`,
      'utf-8',
    );
    writeFileSync(
      join(rootDir, 'src', 'features', 'auth', 'LoginForm.tsx'),
      `export function LoginForm() { return <form />; }`,
      'utf-8',
    );

    const result = discoverComponents(rootDir, defaultScanConfig);

    expect(result).toHaveLength(2);
    const files = result.map((r) => r.file);
    expect(files.some((f) => f.includes('Button.tsx'))).toBe(true);
    expect(files.some((f) => f.includes('LoginForm.tsx'))).toBe(true);
  });
});
