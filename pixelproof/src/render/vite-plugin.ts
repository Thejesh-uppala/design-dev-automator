import type { Plugin } from 'vite';
import type { PixelProofConfig } from '../config/schema.js';
import type { ProviderConfig } from './provider-detector.js';

const VIRTUAL_MODULE_ID = 'virtual:pixelproof-harness';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;
const DASHBOARD_VIRTUAL_ID = 'virtual:pixelproof-dashboard';
const RESOLVED_DASHBOARD_ID = '\0' + DASHBOARD_VIRTUAL_ID;

export interface PixelProofPluginOptions {
  config: PixelProofConfig;
  providers?: ProviderConfig[];
}

/**
 * Generate the harness entry module code.
 * Renders a target component based on URL query parameters.
 */
export function generateHarnessEntry(
  options: PixelProofPluginOptions,
): string {
  const providerImports = generateProviderImports(options.providers ?? []);
  const providerWrapOpen = generateProviderWrapOpen(options.providers ?? []);
  const providerWrapClose = generateProviderWrapClose(options.providers ?? []);
  const mockPropsCode = generateMockPropsCode(options.config);

  return `
import React, { useState, useEffect, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
${providerImports}

function ErrorBoundary({ children, componentName }) {
  const [error, setError] = React.useState(null);
  const [errorInfo, setErrorInfo] = React.useState(null);

  if (error) {
    // Notify parent window of render error
    try {
      window.parent.postMessage({
        type: 'render-error',
        component: componentName,
        error: error.message,
      }, '*');
    } catch (e) {}

    return React.createElement('div', {
      style: {
        padding: '16px',
        fontFamily: 'monospace',
        color: '#dc2626',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '4px',
      }
    },
      React.createElement('h3', { style: { margin: '0 0 8px' } }, 'Render Error: ' + componentName),
      React.createElement('pre', {
        style: { margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px' }
      }, error.message),
      error.stack ? React.createElement('pre', {
        style: { margin: '8px 0 0', whiteSpace: 'pre-wrap', fontSize: '10px', opacity: 0.7 }
      }, error.stack.split('\\n').slice(0, 5).join('\\n')) : null,
    );
  }

  return React.createElement(
    ErrorBoundaryClass,
    {
      onError: (err, info) => {
        setError(err);
        setErrorInfo(info);
      },
      resetKey: componentName,
    },
    children,
  );
}

class ErrorBoundaryClass extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    this.props.onError(error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

${mockPropsCode}

function HarnessApp() {
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(null);
  const [componentName, setComponentName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const componentPath = params.get('component');
    const exportName = params.get('export') || 'default';

    if (!componentPath) {
      setError('No component specified');
      return;
    }

    setComponentName(exportName);

    import(/* @vite-ignore */ '/' + componentPath)
      .then((mod) => {
        const Comp = exportName === 'default' ? mod.default : mod[exportName];
        if (!Comp) {
          const available = Object.keys(mod).filter(k => k !== '__esModule').join(', ');
          setError("Export '" + exportName + "' not found in " + componentPath + ". Available exports: " + (available || 'none'));
          return;
        }
        setComponent(() => Comp);
      })
      .catch(() => {
        setError('Component not found: ' + componentPath);
      });
  }, []);

  if (error) {
    return React.createElement('div', {
      style: {
        padding: '16px',
        fontFamily: 'monospace',
        color: '#b45309',
        backgroundColor: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: '4px',
      }
    }, error);
  }

  if (!Component) {
    return React.createElement('div', {
      style: { padding: '16px', fontFamily: 'monospace', color: '#6b7280' }
    }, 'Loading component...');
  }

  const props = getMockProps(componentName);

  return React.createElement(
    ErrorBoundary,
    { componentName },
    ${providerWrapOpen}
      React.createElement(Component, props)
    ${providerWrapClose}
  );
}

const root = createRoot(document.getElementById('pixelproof-root'));
root.render(React.createElement(HarnessApp));
`.trim();
}

/**
 * Generate import statements for detected/configured providers.
 */
function generateProviderImports(providers: ProviderConfig[]): string {
  return providers
    .filter((p) => !p.hasDynamicProps)
    .map((p) => {
      const lines: string[] = [];
      lines.push(`import { ${p.component} } from '${p.importPath}';`);
      for (const [_propName, importSource] of Object.entries(
        p.staticProps,
      )) {
        if (importSource && typeof importSource === 'string') {
          lines.push(`import { ${_propName} } from '${importSource}';`);
        }
      }
      return lines.join('\n');
    })
    .join('\n');
}

/**
 * Generate provider wrapping open tags.
 */
function generateProviderWrapOpen(providers: ProviderConfig[]): string {
  const active = providers.filter((p) => !p.hasDynamicProps);
  if (active.length === 0) return '';

  return active
    .map((p) => {
      const propsStr = Object.keys(p.staticProps)
        .map((k) => `${k}: ${k}`)
        .join(', ');
      const propsArg = propsStr ? `, { ${propsStr} }` : ', null';
      return `React.createElement(${p.component}${propsArg},`;
    })
    .join('\n    ');
}

/**
 * Generate provider wrapping close parens.
 */
function generateProviderWrapClose(providers: ProviderConfig[]): string {
  const active = providers.filter((p) => !p.hasDynamicProps);
  if (active.length === 0) return '';
  return ')'.repeat(active.length);
}

/**
 * Generate mock props lookup code.
 */
function generateMockPropsCode(config: PixelProofConfig): string {
  const components = config.render?.components;
  if (!components || Object.keys(components).length === 0) {
    return `function getMockProps() { return undefined; }`;
  }

  const entries = Object.entries(components)
    .filter(([, v]) => v.mockProps != null)
    .map(([name, v]) => `  ${JSON.stringify(name)}: ${JSON.stringify(v.mockProps)}`)
    .join(',\n');

  return `
const MOCK_PROPS = {
${entries}
};
function getMockProps(name) { return MOCK_PROPS[name] || undefined; }
`.trim();
}

/**
 * Vite plugin for PixelProof harness.
 * Registers a virtual module and serves the harness HTML.
 */
export function pixelproofPlugin(options: PixelProofPluginOptions): Plugin {
  return {
    name: 'pixelproof-harness',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url === '/' || url === '/index.html') {
          res.setHeader('Content-Type', 'text/html');
          res.end(generateDashboardHTML());
          return;
        }
        if (url.startsWith('/harness')) {
          res.setHeader('Content-Type', 'text/html');
          res.end(generateHarnessHTML());
          return;
        }
        next();
      });
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
      if (id === DASHBOARD_VIRTUAL_ID) {
        return RESOLVED_DASHBOARD_ID;
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        return generateHarnessEntry(options);
      }
      if (id === RESOLVED_DASHBOARD_ID) {
        return generateDashboardEntry();
      }
    },
  };
}

/**
 * Generate the harness HTML page.
 */
function generateHarnessHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PixelProof Harness</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    #pixelproof-root { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="pixelproof-root"></div>
  <script type="module" src="virtual:pixelproof-harness"></script>
</body>
</html>`;
}

/**
 * Generate the dashboard HTML page.
 */
export function generateDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PixelProof Dashboard</title>
</head>
<body>
  <div id="pixelproof-dashboard"></div>
  <script type="module" src="virtual:pixelproof-dashboard"></script>
</body>
</html>`;
}

/**
 * Generate the dashboard entry module code.
 * Dynamically imports the real dashboard entry from the package directory.
 */
export function generateDashboardEntry(): string {
  // Use import.meta.url to resolve the dashboard source relative to this file
  const dashboardPath = new URL('../dashboard/main.tsx', import.meta.url).pathname;
  // Normalize Windows paths for Vite
  const normalized = dashboardPath.replace(/^\/([A-Z]:)/, '$1');
  return `import '${normalized}';`;
}
