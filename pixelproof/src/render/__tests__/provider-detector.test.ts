import { describe, it, expect } from 'vitest';
import { detectProvidersFromSource } from '../provider-detector.js';

describe('Provider Detection', () => {
  it('detects ThemeProvider with static theme prop', () => {
    const source = `
      import { ThemeProvider } from '@mui/material';
      import { theme } from './theme';

      export function App() {
        return (
          <ThemeProvider theme={theme}>
            <Main />
          </ThemeProvider>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(1);
    expect(result[0].component).toBe('ThemeProvider');
    expect(result[0].importPath).toBe('@mui/material');
    expect(result[0].staticProps).toEqual({ theme: './theme' });
    expect(result[0].hasDynamicProps).toBe(false);
  });

  it('detects react-redux Provider', () => {
    const source = `
      import { Provider } from 'react-redux';
      import { store } from './store';

      export function App() {
        return (
          <Provider store={store}>
            <Main />
          </Provider>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(1);
    expect(result[0].component).toBe('Provider');
    expect(result[0].importPath).toBe('react-redux');
  });

  it('marks dynamic props correctly (function call)', () => {
    const source = `
      import { ThemeProvider } from '@mui/material';

      export function App() {
        return (
          <ThemeProvider theme={getTheme()}>
            <Main />
          </ThemeProvider>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(1);
    expect(result[0].hasDynamicProps).toBe(true);
  });

  it('returns empty array when no providers found', () => {
    const source = `
      export function App() {
        return <div><Main /></div>;
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(0);
  });

  it('detects multiple providers in nesting order (outermost first)', () => {
    const source = `
      import { ChakraProvider } from '@chakra-ui/react';
      import { MantineProvider } from '@mantine/core';

      export function App() {
        return (
          <ChakraProvider>
            <MantineProvider>
              <Main />
            </MantineProvider>
          </ChakraProvider>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(2);
    expect(result[0].component).toBe('ChakraProvider');
    expect(result[1].component).toBe('MantineProvider');
  });

  it('detects QueryClientProvider', () => {
    const source = `
      import { QueryClientProvider } from '@tanstack/react-query';
      import { queryClient } from './query-client';

      export function App() {
        return (
          <QueryClientProvider client={queryClient}>
            <Main />
          </QueryClientProvider>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(1);
    expect(result[0].component).toBe('QueryClientProvider');
    expect(result[0].importPath).toBe('@tanstack/react-query');
  });

  it('detects BrowserRouter', () => {
    const source = `
      import { BrowserRouter } from 'react-router-dom';

      export function App() {
        return (
          <BrowserRouter>
            <Main />
          </BrowserRouter>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(1);
    expect(result[0].component).toBe('BrowserRouter');
    expect(result[0].importPath).toBe('react-router-dom');
  });

  it('detects I18nextProvider', () => {
    const source = `
      import { I18nextProvider } from 'react-i18next';
      import i18n from './i18n';

      export function App() {
        return (
          <I18nextProvider i18n={i18n}>
            <Main />
          </I18nextProvider>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(1);
    expect(result[0].component).toBe('I18nextProvider');
  });

  it('ignores unknown JSX elements', () => {
    const source = `
      import { MyCustomThing } from './custom';

      export function App() {
        return (
          <MyCustomThing>
            <Main />
          </MyCustomThing>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(0);
  });

  it('handles styled-components ThemeProvider', () => {
    const source = `
      import { ThemeProvider } from 'styled-components';
      import { theme } from './theme';

      export function App() {
        return (
          <ThemeProvider theme={theme}>
            <Main />
          </ThemeProvider>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(1);
    expect(result[0].importPath).toBe('styled-components');
  });

  it('handles provider with no props', () => {
    const source = `
      import { ChakraProvider } from '@chakra-ui/react';

      export function App() {
        return (
          <ChakraProvider>
            <Main />
          </ChakraProvider>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(1);
    expect(result[0].staticProps).toEqual({});
    expect(result[0].hasDynamicProps).toBe(false);
  });

  it('handles non-imported identifier as dynamic prop', () => {
    const source = `
      import { Provider } from 'react-redux';

      const store = createStore(reducer);

      export function App() {
        return (
          <Provider store={store}>
            <Main />
          </Provider>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(1);
    // store is declared locally, not imported — treated as dynamic
    expect(result[0].hasDynamicProps).toBe(true);
  });

  it('detects Emotion ThemeProvider', () => {
    const source = `
      import { ThemeProvider } from '@emotion/react';
      import { theme } from './theme';

      export function App() {
        return (
          <ThemeProvider theme={theme}>
            <Main />
          </ThemeProvider>
        );
      }
    `;
    const result = detectProvidersFromSource(source, 'main.tsx');
    expect(result).toHaveLength(1);
    expect(result[0].importPath).toBe('@emotion/react');
  });
});
