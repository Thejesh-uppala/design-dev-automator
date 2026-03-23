import fg from 'fast-glob';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import type { ScanConfig } from '../config/schema.js';
import { parseExports } from './detect-exports.js';

export interface ComponentEntry {
  file: string;
  exports: string[];
}

const STYLE_EXTENSIONS = new Set(['.css', '.scss']);

/**
 * Discover React components in the project.
 *
 * Globs files matching scan.include, filtered by scan.exclude and scan.fileTypes.
 * AST-parses JS/TS files to detect exported React components.
 * CSS/SCSS files are included with empty exports (scanned for token violations only).
 *
 * @param rootDir - Project root directory
 * @param scanConfig - Scan configuration with include/exclude/fileTypes
 * @returns Array of ComponentEntry with file paths and detected exports
 */
export function discoverComponents(
  rootDir: string,
  scanConfig: ScanConfig,
): ComponentEntry[] {
  const allowedExtensions = new Set(
    scanConfig.fileTypes.map((t) => `.${t}`),
  );

  const files = fg.sync(scanConfig.include, {
    cwd: rootDir,
    ignore: scanConfig.exclude,
    onlyFiles: true,
    dot: false,
  });

  // Filter by allowed file types
  const filtered = files.filter((f) =>
    allowedExtensions.has(extname(f).toLowerCase()),
  );

  const entries: ComponentEntry[] = [];

  for (const file of filtered) {
    const ext = extname(file).toLowerCase();

    if (STYLE_EXTENSIONS.has(ext)) {
      // CSS/SCSS — include with empty exports
      entries.push({ file, exports: [] });
    } else {
      const source = readFileSync(resolve(rootDir, file), 'utf-8');
      const exports = parseExports(source);
      entries.push({ file, exports });
    }
  }

  return entries;
}
