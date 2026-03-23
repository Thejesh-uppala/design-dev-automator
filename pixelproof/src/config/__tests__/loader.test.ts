import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, findConfig, parseConfig, interpolateEnvVars } from '../loader.js';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'pixelproof-test-'));
}

describe('Configuration Loader', () => {
  let tempDir: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tempDir = createTempDir();
    savedEnv['FIGMA_PAT'] = process.env['FIGMA_PAT'];
    savedEnv['TEST_VAR'] = process.env['TEST_VAR'];
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    // Restore env
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  describe('findConfig', () => {
    it('finds .pixelproofrc (extensionless) first', () => {
      writeFileSync(join(tempDir, '.pixelproofrc'), '{"scan":{"include":["src/**"]}}');
      writeFileSync(join(tempDir, '.pixelproofrc.json'), '{"scan":{"include":["lib/**"]}}');
      const found = findConfig(tempDir);
      expect(found).toBe(join(tempDir, '.pixelproofrc'));
    });

    it('finds .pixelproofrc.json when no extensionless file', () => {
      writeFileSync(join(tempDir, '.pixelproofrc.json'), '{"scan":{"include":["src/**"]}}');
      writeFileSync(join(tempDir, '.pixelproofrc.yaml'), 'scan:\n  include:\n    - lib/**');
      const found = findConfig(tempDir);
      expect(found).toBe(join(tempDir, '.pixelproofrc.json'));
    });

    it('returns null when no config file exists', () => {
      const found = findConfig(tempDir);
      expect(found).toBeNull();
    });
  });

  describe('parseConfig', () => {
    it('parses JSON files', () => {
      const filePath = join(tempDir, '.pixelproofrc.json');
      writeFileSync(filePath, '{"figma":{"fileId":"abc123"}}');
      const result = parseConfig(filePath);
      expect(result).toEqual({ figma: { fileId: 'abc123' } });
    });

    it('parses YAML files', () => {
      const filePath = join(tempDir, '.pixelproofrc.yaml');
      writeFileSync(filePath, 'figma:\n  fileId: abc123\n');
      const result = parseConfig(filePath);
      expect(result).toEqual({ figma: { fileId: 'abc123' } });
    });

    it('parses extensionless file as JSON', () => {
      const filePath = join(tempDir, '.pixelproofrc');
      writeFileSync(filePath, '{"figma":{"fileId":"abc123"}}');
      const result = parseConfig(filePath);
      expect(result).toEqual({ figma: { fileId: 'abc123' } });
    });

    it('parses extensionless file as YAML when JSON fails', () => {
      const filePath = join(tempDir, '.pixelproofrc');
      writeFileSync(filePath, 'figma:\n  fileId: abc123\n');
      const result = parseConfig(filePath);
      expect(result).toEqual({ figma: { fileId: 'abc123' } });
    });

    it('throws on invalid YAML', () => {
      const filePath = join(tempDir, '.pixelproofrc.yaml');
      writeFileSync(filePath, '  invalid:\n yaml: [broken');
      expect(() => parseConfig(filePath)).toThrow();
    });
  });

  describe('interpolateEnvVars', () => {
    it('replaces ${VAR} with env value', () => {
      process.env['TEST_VAR'] = 'hello';
      const result = interpolateEnvVars({ key: '${TEST_VAR}' });
      expect(result.key).toBe('hello');
    });

    it('throws when env var is not set', () => {
      delete process.env['MISSING_VAR'];
      expect(() => interpolateEnvVars({ figma: { pat: '${MISSING_VAR}' } })).toThrow(
        'Environment variable MISSING_VAR is not set (referenced in figma.pat)',
      );
    });

    it('does not modify non-string values', () => {
      const result = interpolateEnvVars({ port: 3001, enabled: true });
      expect(result).toEqual({ port: 3001, enabled: true });
    });
  });

  describe('loadConfig', () => {
    it('returns fully populated config from valid YAML with all fields', () => {
      const yamlContent = `
figma:
  fileId: "abc123"
  personalAccessToken: "pat-token"
  syncTTL: 3600
scan:
  include:
    - "src/components/**"
  exclude:
    - "**/*.test.tsx"
  fileTypes:
    - tsx
    - ts
tokens:
  format: "dtcg"
  fallbackDir: "design-tokens/"
dashboard:
  port: 4000
render:
  enabled: false
  viewport:
    width: 1920
    height: 1080
  tolerance: 8
  theme: "dark"
`;
      writeFileSync(join(tempDir, '.pixelproofrc.yaml'), yamlContent);
      const config = loadConfig(tempDir);

      expect(config.figma).toEqual({
        fileId: 'abc123',
        personalAccessToken: 'pat-token',
        syncTTL: 3600,
      });
      expect(config.scan.include).toEqual(['src/components/**']);
      expect(config.tokens.fallbackDir).toBe('design-tokens/');
      expect(config.dashboard.port).toBe(4000);
      expect(config.render.enabled).toBe(false);
      expect(config.render.viewport).toEqual({ width: 1920, height: 1080 });
      expect(config.render.tolerance).toBe(8);
      expect(config.render.theme).toBe('dark');
    });

    it('fills defaults when JSON has only figma.fileId', () => {
      const jsonContent = JSON.stringify({
        figma: { fileId: 'abc123', personalAccessToken: 'pat-token' },
      });
      writeFileSync(join(tempDir, '.pixelproofrc.json'), jsonContent);
      const config = loadConfig(tempDir);

      expect(config.figma?.fileId).toBe('abc123');
      expect(config.figma?.syncTTL).toBe(86400); // default
      expect(config.scan.include).toEqual(['src/**']); // default
      expect(config.scan.exclude).toEqual([
        '**/*.test.tsx',
        '**/*.test.ts',
        '**/*.stories.tsx',
        '**/node_modules/**',
      ]);
      expect(config.tokens.format).toBe('dtcg');
      expect(config.dashboard.port).toBe(3001);
      expect(config.render.enabled).toBe(true);
      expect(config.render.tolerance).toBe(4);
    });

    it('interpolates ${FIGMA_PAT} when env var is set', () => {
      process.env['FIGMA_PAT'] = 'secret-pat-token';
      const yamlContent = `
figma:
  fileId: "abc123"
  personalAccessToken: "\${FIGMA_PAT}"
`;
      writeFileSync(join(tempDir, '.pixelproofrc.yaml'), yamlContent);
      const config = loadConfig(tempDir);
      expect(config.figma?.personalAccessToken).toBe('secret-pat-token');
    });

    it('throws descriptive error when ${FIGMA_PAT} env var is NOT set', () => {
      delete process.env['FIGMA_PAT'];
      const yamlContent = `
figma:
  fileId: "abc123"
  personalAccessToken: "\${FIGMA_PAT}"
`;
      writeFileSync(join(tempDir, '.pixelproofrc.yaml'), yamlContent);
      expect(() => loadConfig(tempDir)).toThrow(
        'Environment variable FIGMA_PAT is not set (referenced in figma.personalAccessToken)',
      );
    });

    it('returns all defaults with figma undefined when no config file', () => {
      const config = loadConfig(tempDir);
      expect(config.figma).toBeUndefined();
      expect(config.scan.include).toEqual(['src/**']);
      expect(config.tokens.format).toBe('dtcg');
      expect(config.dashboard.port).toBe(3001);
      expect(config.render.enabled).toBe(true);
      expect(config.render.tolerance).toBe(4);
      expect(config.render.theme).toBe('light');
    });

    it('throws validation error when personalAccessToken present without fileId', () => {
      const jsonContent = JSON.stringify({
        figma: { personalAccessToken: 'some-token' },
      });
      writeFileSync(join(tempDir, '.pixelproofrc.json'), jsonContent);
      expect(() => loadConfig(tempDir)).toThrow(
        'figma.fileId is required when figma.personalAccessToken is provided',
      );
    });

    it('respects config discovery priority order', () => {
      // extensionless should win over .json
      writeFileSync(join(tempDir, '.pixelproofrc'), JSON.stringify({
        dashboard: { port: 9999 },
      }));
      writeFileSync(join(tempDir, '.pixelproofrc.json'), JSON.stringify({
        dashboard: { port: 1111 },
      }));
      const config = loadConfig(tempDir);
      expect(config.dashboard.port).toBe(9999);
    });
  });
});
