/**
 * Static whitelist of CSS values that should never be flagged as violations.
 * These are valid CSS keywords and common zero/identity values.
 */

const WHITELIST_VALUES = [
  'transparent',
  'inherit',
  'currentcolor',
  'none',
  'initial',
  'unset',
  'revert',
  'auto',
  '0',
  '100%',
  '50%',
  'white',
  'black',
  '0px',
];

const WHITELIST = new Set(WHITELIST_VALUES);

/**
 * Check if a value is whitelisted (case-insensitive).
 */
export function isWhitelisted(value: string): boolean {
  return WHITELIST.has(value.trim().toLowerCase());
}
