export type TokenFormat =
  | 'dtcg'
  | 'style-dictionary-css'
  | 'style-dictionary-js'
  | 'token-studio'
  | 'unknown';

/**
 * Detect token format from filename extension and content.
 *
 * Detection rules:
 * - `.css` → style-dictionary-css
 * - `.js` or `.ts` → style-dictionary-js
 * - `.json` with `"$value"` → dtcg
 * - `.json` with `"value"` (no `$`) → token-studio
 * - Otherwise → unknown
 */
export function detectTokenFormat(
  filename: string,
  content: string,
): TokenFormat {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

  if (ext === '.css') {
    return 'style-dictionary-css';
  }

  if (ext === '.js' || ext === '.ts') {
    return 'style-dictionary-js';
  }

  if (ext === '.json') {
    if (content.includes('"$value"')) {
      return 'dtcg';
    }
    if (content.includes('"value"')) {
      return 'token-studio';
    }
  }

  return 'unknown';
}
