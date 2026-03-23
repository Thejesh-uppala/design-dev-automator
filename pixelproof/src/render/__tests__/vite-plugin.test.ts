import { describe, it, expect } from 'vitest';
import {
  generateHarnessEntry,
  generateDashboardHTML,
  generateDashboardEntry,
  pixelproofPlugin,
  type PixelProofPluginOptions,
} from '../vite-plugin.js';
import type { PixelProofConfig } from '../../config/schema.js';

function makeConfig(
  overrides: Partial<PixelProofConfig> = {},
): PixelProofConfig {
  return {
    scan: { include: ['src/**'], exclude: [], fileTypes: ['tsx', 'ts'] },
    tokens: { format: 'dtcg', fallbackDir: 'tokens/' },
    dashboard: { port: 3001 },
    render: {
      enabled: true,
      viewport: { width: 1440, height: 900 },
      tolerance: 4,
      theme: 'light',
      ...overrides.render,
    },
    ...overrides,
  };
}

function makeOptions(
  overrides: Partial<PixelProofPluginOptions> = {},
): PixelProofPluginOptions {
  return {
    config: makeConfig(),
    providers: [],
    ...overrides,
  };
}

describe('generateHarnessEntry', () => {
  it('imports React and createRoot', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain("import React");
    expect(code).toContain("from 'react'");
    expect(code).toContain("from 'react-dom/client'");
  });

  it('renders into pixelproof-root element', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain("getElementById('pixelproof-root')");
  });

  it('reads component and export from URL query params', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain("params.get('component')");
    expect(code).toContain("params.get('export')");
  });

  it('shows "No component specified" when no query params', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain('No component specified');
  });

  it('shows "Component not found" on import failure', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain('Component not found: ');
  });

  it('shows "Export not found" with available exports when export missing', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain("not found in");
    expect(code).toContain("Available exports:");
  });

  it('defaults to "default" export when export param is absent', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain("|| 'default'");
  });

  it('uses @vite-ignore on dynamic import', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain('@vite-ignore');
  });

  it('includes ErrorBoundary wrapping', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain('ErrorBoundary');
    expect(code).toContain('render-error');
  });

  it('includes postMessage for render errors', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain("window.parent.postMessage");
    expect(code).toContain("type: 'render-error'");
  });

  it('generates getMockProps that returns undefined when no config', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain('getMockProps');
    expect(code).toContain('return undefined');
  });
});

describe('generateHarnessEntry with providers', () => {
  it('generates import for provider with static props', () => {
    const code = generateHarnessEntry(
      makeOptions({
        providers: [
          {
            component: 'ThemeProvider',
            importPath: '@mui/material',
            staticProps: { theme: './theme' },
            hasDynamicProps: false,
          },
        ],
      }),
    );
    expect(code).toContain("import { ThemeProvider } from '@mui/material'");
    expect(code).toContain("import { theme } from './theme'");
  });

  it('skips provider with dynamic props', () => {
    const code = generateHarnessEntry(
      makeOptions({
        providers: [
          {
            component: 'ThemeProvider',
            importPath: '@mui/material',
            staticProps: {},
            hasDynamicProps: true,
          },
        ],
      }),
    );
    expect(code).not.toContain("import { ThemeProvider }");
  });

  it('wraps component with React.createElement for providers', () => {
    const code = generateHarnessEntry(
      makeOptions({
        providers: [
          {
            component: 'ThemeProvider',
            importPath: '@mui/material',
            staticProps: {},
            hasDynamicProps: false,
          },
        ],
      }),
    );
    expect(code).toContain('React.createElement(ThemeProvider');
  });

  it('handles multiple providers in order', () => {
    const code = generateHarnessEntry(
      makeOptions({
        providers: [
          {
            component: 'ChakraProvider',
            importPath: '@chakra-ui/react',
            staticProps: {},
            hasDynamicProps: false,
          },
          {
            component: 'MantineProvider',
            importPath: '@mantine/core',
            staticProps: {},
            hasDynamicProps: false,
          },
        ],
      }),
    );
    const chakraIdx = code.indexOf('React.createElement(ChakraProvider');
    const mantineIdx = code.indexOf('React.createElement(MantineProvider');
    expect(chakraIdx).toBeLessThan(mantineIdx);
  });
});

describe('generateHarnessEntry with mockProps', () => {
  it('generates MOCK_PROPS lookup table', () => {
    const code = generateHarnessEntry(
      makeOptions({
        config: makeConfig({
          render: {
            enabled: true,
            viewport: { width: 1440, height: 900 },
            tolerance: 4,
            theme: 'light',
            components: {
              Button: { mockProps: { variant: 'primary' } },
            },
          },
        }),
      }),
    );
    expect(code).toContain('MOCK_PROPS');
    expect(code).toContain('"Button"');
  });
});

describe('pixelproofPlugin', () => {
  it('returns a Vite plugin with correct name', () => {
    const plugin = pixelproofPlugin(makeOptions());
    expect(plugin.name).toBe('pixelproof-harness');
  });

  it('resolves virtual module ID', () => {
    const plugin = pixelproofPlugin(makeOptions());
    const resolveId = plugin.resolveId as (id: string) => string | undefined;
    expect(resolveId('virtual:pixelproof-harness')).toBe(
      '\0virtual:pixelproof-harness',
    );
  });

  it('returns undefined for non-virtual module IDs', () => {
    const plugin = pixelproofPlugin(makeOptions());
    const resolveId = plugin.resolveId as (id: string) => string | undefined;
    expect(resolveId('some-other-module')).toBeUndefined();
  });

  it('loads virtual module content', () => {
    const plugin = pixelproofPlugin(makeOptions());
    const load = plugin.load as (id: string) => string | undefined;
    const code = load('\0virtual:pixelproof-harness');
    expect(code).toContain('HarnessApp');
    expect(code).toContain('pixelproof-root');
  });

  it('returns undefined for non-virtual module load', () => {
    const plugin = pixelproofPlugin(makeOptions());
    const load = plugin.load as (id: string) => string | undefined;
    expect(load('some-other-id')).toBeUndefined();
  });

  it('has configureServer hook', () => {
    const plugin = pixelproofPlugin(makeOptions());
    expect(plugin.configureServer).toBeInstanceOf(Function);
  });

  it('resolves dashboard virtual module ID', () => {
    const plugin = pixelproofPlugin(makeOptions());
    const resolveId = plugin.resolveId as (id: string) => string | undefined;
    expect(resolveId('virtual:pixelproof-dashboard')).toBe(
      '\0virtual:pixelproof-dashboard',
    );
  });

  it('loads dashboard virtual module content', () => {
    const plugin = pixelproofPlugin(makeOptions());
    const load = plugin.load as (id: string) => string | undefined;
    const code = load('\0virtual:pixelproof-dashboard');
    expect(code).toContain('dashboard/main.tsx');
  });
});

describe('Dashboard HTML Generation', () => {
  it('generates valid dashboard HTML', () => {
    const html = generateDashboardHTML();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('pixelproof-dashboard');
    expect(html).toContain('virtual:pixelproof-dashboard');
    expect(html).toContain('PixelProof Dashboard');
  });

  it('generates dashboard entry with import path', () => {
    const entry = generateDashboardEntry();
    expect(entry).toContain('import');
    expect(entry).toContain('main.tsx');
  });
});
