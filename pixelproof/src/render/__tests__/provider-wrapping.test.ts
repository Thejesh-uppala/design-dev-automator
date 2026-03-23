import { describe, it, expect } from 'vitest';
import { generateHarnessEntry } from '../vite-plugin.js';
import type { PixelProofPluginOptions } from '../vite-plugin.js';
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

describe('Provider Wrapping in Harness', () => {
  it('renders component bare when no providers', () => {
    const code = generateHarnessEntry(makeOptions({ providers: [] }));
    // Should just have React.createElement(Component, props) without wrapping
    expect(code).toContain('React.createElement(Component, props)');
    // Should NOT have any provider createElement calls near the component
    expect(code).not.toContain('React.createElement(ThemeProvider');
  });

  it('wraps with single provider in correct order', () => {
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

    // Should import the provider and its static props
    expect(code).toContain("import { ThemeProvider } from '@mui/material'");
    expect(code).toContain("import { theme } from './theme'");

    // Should wrap with createElement
    expect(code).toContain('React.createElement(ThemeProvider');
  });

  it('wraps with multiple providers preserving nesting order', () => {
    const code = generateHarnessEntry(
      makeOptions({
        providers: [
          {
            component: 'ThemeProvider',
            importPath: '@mui/material',
            staticProps: {},
            hasDynamicProps: false,
          },
          {
            component: 'Provider',
            importPath: 'react-redux',
            staticProps: {},
            hasDynamicProps: false,
          },
        ],
      }),
    );

    const themeIdx = code.indexOf('React.createElement(ThemeProvider');
    const reduxIdx = code.indexOf('React.createElement(Provider');
    // ThemeProvider (outer) should come first in the nesting
    expect(themeIdx).toBeGreaterThan(-1);
    expect(reduxIdx).toBeGreaterThan(-1);
    expect(themeIdx).toBeLessThan(reduxIdx);
  });

  it('skips providers with dynamic props (logs warning)', () => {
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

    // Should NOT import or wrap with the dynamic provider
    expect(code).not.toContain("import { ThemeProvider }");
    expect(code).not.toContain('React.createElement(ThemeProvider');
  });

  it('passes static props to provider createElement', () => {
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

    // Should pass static props
    expect(code).toContain('{ theme: theme }');
  });

  it('passes null when provider has no static props', () => {
    const code = generateHarnessEntry(
      makeOptions({
        providers: [
          {
            component: 'ChakraProvider',
            importPath: '@chakra-ui/react',
            staticProps: {},
            hasDynamicProps: false,
          },
        ],
      }),
    );

    expect(code).toContain('React.createElement(ChakraProvider, null');
  });

  it('mixes static and dynamic providers — only static are wrapped', () => {
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
            component: 'ThemeProvider',
            importPath: '@mui/material',
            staticProps: {},
            hasDynamicProps: true,
          },
          {
            component: 'Provider',
            importPath: 'react-redux',
            staticProps: {},
            hasDynamicProps: false,
          },
        ],
      }),
    );

    expect(code).toContain('React.createElement(ChakraProvider');
    expect(code).not.toContain("import { ThemeProvider }");
    expect(code).toContain('React.createElement(Provider');
  });
});
