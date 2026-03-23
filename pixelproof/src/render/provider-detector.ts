import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PixelProofConfig } from '../config/schema.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const traverse: (ast: t.Node, opts: import('@babel/traverse').TraverseOptions) => void =
  typeof (_traverse as any).default === 'function'
    ? (_traverse as any).default
    : _traverse as any;

export interface ProviderConfig {
  component: string;
  importPath: string;
  staticProps: Record<string, string>;
  hasDynamicProps: boolean;
}

/** Known provider patterns: component name → typical import source */
const KNOWN_PROVIDERS: Record<string, string[]> = {
  ThemeProvider: [
    '@mui/material',
    '@mui/material/styles',
    'styled-components',
    '@emotion/react',
  ],
  Provider: ['react-redux'],
  QueryClientProvider: ['@tanstack/react-query'],
  RouterProvider: ['react-router-dom', 'react-router'],
  BrowserRouter: ['react-router-dom'],
  AuthProvider: [],
  I18nextProvider: ['react-i18next'],
  ChakraProvider: ['@chakra-ui/react'],
  MantineProvider: ['@mantine/core'],
};

const ENTRY_FILES = [
  'src/main.tsx',
  'src/main.jsx',
  'src/index.tsx',
  'src/index.jsx',
  'src/App.tsx',
  'src/App.jsx',
];

/**
 * Detect React context providers from the project's entry files.
 */
export function detectProviders(
  rootDir: string,
  _config?: PixelProofConfig,
): ProviderConfig[] {
  // Find the first existing entry file
  let entryFile: string | undefined;
  let entrySource: string | undefined;

  for (const file of ENTRY_FILES) {
    const fullPath = resolve(rootDir, file);
    if (existsSync(fullPath)) {
      entryFile = file;
      entrySource = readFileSync(fullPath, 'utf-8');
      break;
    }
  }

  if (!entryFile || !entrySource) {
    return [];
  }

  return detectProvidersFromSource(entrySource, entryFile);
}

/**
 * Detect providers from source code. Exported for testing.
 */
export function detectProvidersFromSource(
  source: string,
  _filename: string,
): ProviderConfig[] {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  // Collect import mappings: localName → importSource
  const importMap = new Map<string, string>();
  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const source = path.node.source.value;
      for (const spec of path.node.specifiers) {
        importMap.set(spec.local.name, source);
      }
    },
  });

  // Collect static imports: localName → { importSource, importedName }
  const importedIdentifiers = new Map<
    string,
    { source: string; imported: string }
  >();
  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const src = path.node.source.value;
      for (const spec of path.node.specifiers) {
        if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported)) {
          importedIdentifiers.set(spec.local.name, {
            source: src,
            imported: spec.imported.name,
          });
        } else if (t.isImportDefaultSpecifier(spec)) {
          importedIdentifiers.set(spec.local.name, {
            source: src,
            imported: 'default',
          });
        }
      }
    },
  });

  // Find JSX elements matching known providers, ordered by nesting depth
  const providers: Array<ProviderConfig & { depth: number }> = [];

  traverse(ast, {
    JSXElement(path: NodePath<t.JSXElement>) {
      const opening = path.node.openingElement;
      let componentName: string | undefined;

      if (t.isJSXIdentifier(opening.name)) {
        componentName = opening.name.name;
      } else if (
        t.isJSXMemberExpression(opening.name) &&
        t.isJSXIdentifier(opening.name.object)
      ) {
        componentName = `${opening.name.object.name}.${opening.name.property.name}`;
      }

      if (!componentName || !(componentName in KNOWN_PROVIDERS)) {
        return;
      }

      // Determine import path
      const knownSources = KNOWN_PROVIDERS[componentName];
      const actualImportPath = importMap.get(componentName);
      const importPath =
        actualImportPath || (knownSources.length > 0 ? knownSources[0] : componentName);

      // Analyze props
      const staticProps: Record<string, string> = {};
      let hasDynamicProps = false;

      for (const attr of opening.attributes) {
        if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) {
          continue;
        }

        const propName = attr.name.name;

        if (
          attr.value &&
          t.isJSXExpressionContainer(attr.value) &&
          t.isIdentifier(attr.value.expression)
        ) {
          // Check if the identifier is a static import
          const importInfo = importedIdentifiers.get(
            attr.value.expression.name,
          );
          if (importInfo) {
            staticProps[propName] = importInfo.source;
          } else {
            hasDynamicProps = true;
          }
        } else if (
          attr.value &&
          t.isJSXExpressionContainer(attr.value) &&
          !t.isJSXEmptyExpression(attr.value.expression)
        ) {
          // Non-identifier expression → dynamic
          hasDynamicProps = true;
        }
      }

      // Calculate nesting depth
      let depth = 0;
      let parent: NodePath | null = path.parentPath;
      while (parent) {
        if (parent.isJSXElement()) depth++;
        parent = parent.parentPath;
      }

      providers.push({
        component: componentName,
        importPath,
        staticProps,
        hasDynamicProps,
        depth,
      });
    },
  });

  // Sort by depth (outermost first = lowest depth)
  providers.sort((a, b) => a.depth - b.depth);

  // Remove depth from output
  return providers.map(({ depth: _, ...rest }) => rest);
}
