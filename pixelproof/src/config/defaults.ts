import type { PixelProofConfig } from './schema.js';

export const DEFAULT_CONFIG: Omit<PixelProofConfig, 'figma'> = {
  scan: {
    include: ['src/**'],
    exclude: ['**/*.test.tsx', '**/*.test.ts', '**/*.stories.tsx', '**/node_modules/**'],
    fileTypes: ['tsx', 'ts', 'jsx', 'js', 'css', 'scss'],
  },
  tokens: {
    format: 'dtcg',
    fallbackDir: 'tokens/',
  },
  dashboard: {
    port: 3001,
  },
  render: {
    enabled: true,
    viewport: { width: 1440, height: 900 },
    tolerance: 4,
    theme: 'light',
  },
};

export const DEFAULT_FIGMA_SYNC_TTL = 86400;
