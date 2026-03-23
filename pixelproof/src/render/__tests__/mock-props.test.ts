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

describe('mockProps Support', () => {
  it('renders <Component /> with no props when no mockProps configured', () => {
    const code = generateHarnessEntry(makeOptions());
    expect(code).toContain('getMockProps');
    expect(code).toContain('return undefined');
    // Component rendered with getMockProps result (undefined = no props)
    expect(code).toContain('React.createElement(Component, props)');
  });

  it('generates MOCK_PROPS lookup when mockProps configured for Button', () => {
    const code = generateHarnessEntry(
      makeOptions({
        config: makeConfig({
          render: {
            enabled: true,
            viewport: { width: 1440, height: 900 },
            tolerance: 4,
            theme: 'light',
            components: {
              Button: { mockProps: { variant: 'primary', size: 'lg' } },
            },
          },
        }),
      }),
    );

    expect(code).toContain('MOCK_PROPS');
    expect(code).toContain('"Button"');
    expect(code).toContain('"variant"');
    expect(code).toContain('"primary"');
    expect(code).toContain('"size"');
    expect(code).toContain('"lg"');
  });

  it('supports multiple component mockProps', () => {
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
              Card: { mockProps: { title: 'Hello' } },
            },
          },
        }),
      }),
    );

    expect(code).toContain('"Button"');
    expect(code).toContain('"Card"');
    expect(code).toContain('"variant"');
    expect(code).toContain('"title"');
  });

  it('handles nested object mockProps', () => {
    const code = generateHarnessEntry(
      makeOptions({
        config: makeConfig({
          render: {
            enabled: true,
            viewport: { width: 1440, height: 900 },
            tolerance: 4,
            theme: 'light',
            components: {
              Widget: {
                mockProps: { style: { color: 'red', fontSize: 14 } },
              },
            },
          },
        }),
      }),
    );

    expect(code).toContain('"Widget"');
    expect(code).toContain('"color"');
    expect(code).toContain('"red"');
  });

  it('handles array mockProps', () => {
    const code = generateHarnessEntry(
      makeOptions({
        config: makeConfig({
          render: {
            enabled: true,
            viewport: { width: 1440, height: 900 },
            tolerance: 4,
            theme: 'light',
            components: {
              DataTable: {
                mockProps: { items: [1, 2, 3], columns: ['Name', 'Email'] },
              },
            },
          },
        }),
      }),
    );

    expect(code).toContain('"DataTable"');
    expect(code).toContain('[1,2,3]');
    expect(code).toContain('["Name","Email"]');
  });

  it('getMockProps returns undefined for unconfigured component', () => {
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

    // getMockProps should fall back to undefined for unknown names
    expect(code).toContain('|| undefined');
  });

  it('handles children as string mockProp', () => {
    const code = generateHarnessEntry(
      makeOptions({
        config: makeConfig({
          render: {
            enabled: true,
            viewport: { width: 1440, height: 900 },
            tolerance: 4,
            theme: 'light',
            components: {
              Button: { mockProps: { children: 'Click me' } },
            },
          },
        }),
      }),
    );

    expect(code).toContain('"children"');
    expect(code).toContain('"Click me"');
  });
});
