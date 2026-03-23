import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import yaml from 'js-yaml';
import type { PixelProofConfig } from './schema.js';
import { DEFAULT_CONFIG, DEFAULT_FIGMA_SYNC_TTL } from './defaults.js';

const CONFIG_FILENAMES = [
  '.pixelproofrc',
  '.pixelproofrc.json',
  '.pixelproofrc.yaml',
  '.pixelproofrc.yml',
];

/**
 * Search for a config file in the given directory, in priority order.
 * Returns the full path of the first match, or null if none found.
 */
export function findConfig(rootDir: string): string | null {
  for (const filename of CONFIG_FILENAMES) {
    const fullPath = join(rootDir, filename);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Parse config file content as JSON or YAML.
 * For extensionless files, tries JSON first, then YAML.
 */
export function parseConfig(filePath: string): Record<string, unknown> {
  const content = readFileSync(filePath, 'utf-8');

  if (filePath.endsWith('.json')) {
    return JSON.parse(content) as Record<string, unknown>;
  }

  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    return yaml.load(content) as Record<string, unknown>;
  }

  // Extensionless — try JSON first, then YAML
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return yaml.load(content) as Record<string, unknown>;
  }
}

/**
 * Recursively interpolate ${ENV_VAR} patterns in string values.
 * Throws if a referenced env var is not set.
 */
export function interpolateEnvVars(
  obj: Record<string, unknown>,
  path: string = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string') {
      result[key] = value.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
        const envValue = process.env[varName];
        if (envValue === undefined) {
          throw new Error(
            `Environment variable ${varName} is not set (referenced in ${currentPath})`,
          );
        }
        return envValue;
      });
    } else if (Array.isArray(value)) {
      result[key] = value.map((item, i) => {
        if (typeof item === 'string') {
          return item.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
            const envValue = process.env[varName];
            if (envValue === undefined) {
              throw new Error(
                `Environment variable ${varName} is not set (referenced in ${currentPath}[${i}])`,
              );
            }
            return envValue;
          });
        }
        if (item !== null && typeof item === 'object') {
          return interpolateEnvVars(item as Record<string, unknown>, `${currentPath}[${i}]`);
        }
        return item;
      });
    } else if (value !== null && typeof value === 'object') {
      result[key] = interpolateEnvVars(value as Record<string, unknown>, currentPath);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Deep merge user config onto defaults.
 * Arrays replace entirely (no element merging).
 */
export function mergeDefaults(
  defaults: Record<string, unknown>,
  userConfig: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults };

  for (const [key, value] of Object.entries(userConfig)) {
    if (value === undefined) continue;

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = mergeDefaults(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Validate the parsed config.
 * Throws on invalid combinations.
 */
function validateConfig(config: Record<string, unknown>): void {
  const figma = config.figma as Record<string, unknown> | undefined;

  if (figma) {
    if (figma.personalAccessToken && !figma.fileId) {
      throw new Error(
        'Configuration error: figma.fileId is required when figma.personalAccessToken is provided',
      );
    }
  }

  const tokens = config.tokens as Record<string, unknown> | undefined;
  if (tokens?.format) {
    const validFormats = ['dtcg', 'style-dictionary', 'token-studio'];
    if (!validFormats.includes(tokens.format as string)) {
      throw new Error(
        `Configuration error: tokens.format must be one of: ${validFormats.join(', ')}`,
      );
    }
  }

  const render = config.render as Record<string, unknown> | undefined;
  if (render?.theme) {
    const validThemes = ['light', 'dark', 'system'];
    if (!validThemes.includes(render.theme as string)) {
      throw new Error(
        `Configuration error: render.theme must be one of: ${validThemes.join(', ')}`,
      );
    }
  }
}

/**
 * Load PixelProof configuration.
 * Searches for config file in rootDir, parses, interpolates env vars,
 * validates, and merges with defaults.
 *
 * @param rootDir - Directory to search for config file. Defaults to cwd.
 * @returns Fully typed PixelProofConfig
 */
export function loadConfig(rootDir?: string): PixelProofConfig {
  const dir = rootDir ?? process.cwd();
  const configPath = findConfig(dir);

  if (!configPath) {
    return { ...DEFAULT_CONFIG } as PixelProofConfig;
  }

  const rawConfig = parseConfig(configPath);
  const interpolated = interpolateEnvVars(rawConfig);
  validateConfig(interpolated);

  // Apply figma.syncTTL default if figma section exists but syncTTL is not set
  if (interpolated.figma) {
    const figma = interpolated.figma as Record<string, unknown>;
    if (figma.syncTTL === undefined) {
      figma.syncTTL = DEFAULT_FIGMA_SYNC_TTL;
    }
  }

  const merged = mergeDefaults(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    interpolated,
  );

  return merged as unknown as PixelProofConfig;
}
