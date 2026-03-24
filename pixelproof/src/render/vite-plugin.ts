import type { Plugin } from 'vite';
import type { PixelProofConfig } from '../config/schema.js';
import type { ProviderConfig } from './provider-detector.js';

const VIRTUAL_MODULE_ID = 'virtual:pixelproof-harness';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

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
      // Pre-middleware: serve dashboard HTML directly (self-contained, no React needed)
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url === '/' || url === '/index.html') {
          const html = generateDashboardHTML();
          res.setHeader('Content-Type', 'text/html');
          res.statusCode = 200;
          res.end(html);
          return;
        }
        next();
      });

      // Post-middleware: serve harness HTML through Vite's transform pipeline
      // (harness needs React refresh preamble for virtual module)
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || '';
          if (url.startsWith('/harness')) {
            let html = generateHarnessHTML();
            html = await server.transformIndexHtml(url, html);
            res.setHeader('Content-Type', 'text/html');
            res.statusCode = 200;
            res.end(html);
            return;
          }
          next();
        });
      };
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        return generateHarnessEntry(options);
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
  <script type="module">import 'virtual:pixelproof-harness';</script>
</body>
</html>`;
}

/**
 * Generate the self-contained dashboard HTML page.
 * Connects to /__pixelproof_ws for live score data.
 * No React or virtual modules needed — pure HTML/CSS/JS.
 */
export function generateDashboardHTML(): string {
  return DASHBOARD_HTML;
}

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PixelProof Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #09090b; --bg1: rgba(18, 18, 20, 0.85); --bg2: rgba(18, 18, 20, 0.6); --bg3: #1e1e24;
  --border: rgba(255,255,255,0.1); --border2: rgba(255,255,255,0.15);
  --text: #fafafa; --muted: #71717a; --muted2: #a1a1aa;
  --accent: #f5a623; --accent2: #ff6b35;
  --green: #4ade80; --red: #f87171; --blue: #60a5fa; --purple: #c084fc;
  --font-head: 'Inter', 'Syne', sans-serif; --font-mono: 'JetBrains Mono', 'IBM Plex Mono', monospace;
  --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.4);
  --backdrop-blur: blur(12px);
}
[data-theme='light'] {
  --bg: #f8fafc; --bg1: rgba(255, 255, 255, 0.85); --bg2: rgba(255, 255, 255, 0.6); --bg3: #e2e8f0;
  --border: rgba(0,0,0,0.1); --border2: rgba(0,0,0,0.15);
  --text: #0f172a; --muted: #94a3b8; --muted2: #475569;
  --accent: #d97706; --accent2: #c2410c;
  --green: #16a34a; --red: #dc2626; --blue: #2563eb; --purple: #9333ea;
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.08);
}
* { margin:0; padding:0; box-sizing:border-box; transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease; }
body { background:var(--bg); color:var(--text); font-family:var(--font-mono); font-size:12px; height:100vh; overflow:hidden; display:flex; flex-direction:column; }

/* TOP BAR */
.topbar { display:flex; align-items:center; justify-content:space-between; padding:0 24px; height:56px; border-bottom:1px solid var(--border); background:var(--bg1); flex-shrink:0; backdrop-filter:var(--backdrop-blur); z-index:10; box-shadow:var(--shadow-sm); }
.topbar-left { display:flex; align-items:center; gap:16px; }
.logo { font-family:var(--font-head); font-size:16px; font-weight:800; letter-spacing:-0.5px; color:var(--text); }
.logo span { color:var(--accent); }
.live-badge { display:flex; align-items:center; gap:6px; background:rgba(46,204,113,0.1); border:1px solid rgba(46,204,113,0.25); border-radius:4px; padding:3px 8px; font-size:10px; color:var(--green); letter-spacing:0.05em; }
.live-dot { width:6px; height:6px; background:var(--green); border-radius:50%; animation:pulse 1.5s ease-in-out infinite; }
.disconnected .live-badge { background:rgba(231,76,60,0.1); border-color:rgba(231,76,60,0.25); color:var(--red); }
.disconnected .live-dot { background:var(--red); animation:none; }
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
.topbar-right { display:flex; align-items:center; gap:20px; }
.stat-pill { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--muted2); }
.stat-pill strong { color:var(--text); font-weight:600; }

/* LAYOUT */
.layout { display:grid; grid-template-columns:280px 1fr 320px; flex:1; overflow:hidden; background: linear-gradient(180deg, var(--bg) 0%, var(--bg3) 100%); }

/* SIDEBAR */
.sidebar { background:var(--bg1); border-right:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; backdrop-filter:var(--backdrop-blur); }
.sidebar-header { padding:14px 16px 10px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; }
.sidebar-title { font-family:var(--font-head); font-weight:700; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted2); }
.count-badge { background:var(--bg3); border:1px solid var(--border2); border-radius:3px; padding:1px 6px; font-size:10px; color:var(--muted2); }
.component-list { overflow-y:auto; flex:1; padding:8px; }
.component-list::-webkit-scrollbar { width:3px; }
.component-list::-webkit-scrollbar-thumb { background:var(--border2); border-radius:3px; }
.comp-card { border:1px solid var(--border); border-radius:8px; padding:10px 12px; margin-bottom:6px; cursor:pointer; transition:all 0.15s ease; background:var(--bg2); }
.comp-card:hover { border-color:var(--border2); background:var(--bg3); }
.comp-card.active { border-color:var(--accent); background:rgba(245,166,35,0.05); }
.comp-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.comp-file { font-size:10px; color:var(--muted); font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:170px; }
.comp-status { font-size:9px; padding:2px 6px; border-radius:3px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; }
.status-rendered { background:rgba(46,204,113,0.12); color:var(--green); border:1px solid rgba(46,204,113,0.25); }
.status-pending { background:rgba(245,166,35,0.15); color:var(--accent); border:1px solid rgba(245,166,35,0.3); }
.status-error { background:rgba(231,76,60,0.12); color:var(--red); border:1px solid rgba(231,76,60,0.25); }
.status-skipped { background:rgba(74,158,255,0.12); color:var(--blue); border:1px solid rgba(74,158,255,0.25); }
.comp-name { font-family:var(--font-head); font-size:12px; font-weight:600; color:var(--text); line-height:1.3; margin-bottom:8px; }
.comp-meta { display:flex; align-items:center; gap:8px; }
.comp-agent { font-size:9px; color:var(--blue); background:rgba(74,158,255,0.08); padding:2px 5px; border-radius:3px; }
.score-mini { display:flex; align-items:center; gap:4px; font-size:10px; color:var(--muted2); }
.score-bar-mini { width:40px; height:3px; background:var(--bg); border-radius:2px; overflow:hidden; }
.score-bar-fill { height:100%; border-radius:2px; transition:width 1s ease; }
.violation-count { font-size:9px; color:var(--red); background:rgba(231,76,60,0.08); padding:2px 5px; border-radius:3px; }

/* MAIN PANEL */
.main { display:flex; flex-direction:column; overflow:hidden; }
.main-header { padding:16px 20px 12px; border-bottom:1px solid var(--border); background:var(--bg1); backdrop-filter:var(--backdrop-blur); }
.main-header-top { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:10px; }
.comp-full-file { font-size:10px; color:var(--muted); margin-bottom:4px; }
.comp-full-name { font-family:var(--font-head); font-size:18px; font-weight:700; color:var(--text); line-height:1.2; }
.main-tabs { display:flex; gap:2px; }
.tab { padding:5px 12px; font-size:11px; border-radius:5px; cursor:pointer; color:var(--muted2); transition:all 0.15s; border:1px solid transparent; }
.tab:hover { color:var(--text); }
.tab.active { background:var(--bg3); border-color:var(--border2); color:var(--text); }

/* COMPARISON VIEW */
.compare-view { flex:1; overflow:hidden; display:flex; flex-direction:column; }
.compare-view.hidden { display:none; }
.comparison-grid { display:grid; grid-template-columns:1fr 1fr; gap:1px; flex:1; overflow:hidden; background:var(--border); }
.compare-pane { background:var(--bg1); display:flex; flex-direction:column; overflow:hidden; }
.pane-header { padding:10px 14px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; background:var(--bg2); flex-shrink:0; }
.pane-label { display:flex; align-items:center; gap:6px; font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; }
.pane-label .dot { width:6px; height:6px; border-radius:50%; }
.figma-dot { background:#a855f7; }
.live-dot2 { background:var(--blue); }
.diff-badge { font-size:9px; padding:2px 6px; border-radius:3px; font-weight:600; }
.diff-pass { background:rgba(46,204,113,0.12); color:var(--green); }
.diff-warn { background:rgba(245,166,35,0.12); color:var(--accent); }
.diff-fail { background:rgba(231,76,60,0.12); color:var(--red); }
.pane-body { flex:1; overflow:auto; position:relative; background:var(--bg); display:flex; align-items:center; justify-content:center; }
.pane-body iframe { border:none; border-radius:4px; background:#fff; display:block; transform-origin:0 0; }
.pane-body::-webkit-scrollbar { width:4px; height:4px; }
.pane-body::-webkit-scrollbar-thumb { background:var(--border2); border-radius:2px; }
/* Checkerboard background for transparency */
.pane-body.checkerboard { background-color:#fafafa; background-image:linear-gradient(45deg,#e5e5e5 25%,transparent 25%),linear-gradient(-45deg,#e5e5e5 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e5e5 75%),linear-gradient(-45deg,transparent 75%,#e5e5e5 75%); background-size:16px 16px; background-position:0 0,0 8px,8px -8px,-8px 0; }
/* Zoom controls */
.zoom-controls { display:flex; align-items:center; gap:2px; }
.zoom-btn { background:var(--bg3); border:1px solid var(--border2); border-radius:3px; color:var(--muted2); font-size:11px; width:22px; height:20px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.1s; font-family:var(--font-mono); }
.zoom-btn:hover { color:var(--text); border-color:var(--accent); }
.zoom-label { font-size:9px; color:var(--muted2); min-width:32px; text-align:center; }
.viewport-select { background:var(--bg3); border:1px solid var(--border2); border-radius:3px; color:var(--muted2); font-size:9px; padding:2px 4px; font-family:var(--font-mono); cursor:pointer; margin-left:4px; }
.viewport-select:hover { border-color:var(--accent); color:var(--text); }
/* Source toggle (Upload / MCP) */
.source-toggle { display:flex; border:1px solid var(--border2); border-radius:3px; overflow:hidden; margin-right:4px; }
.source-toggle-btn { background:var(--bg3); color:var(--muted2); font-size:9px; padding:2px 6px; border:none; cursor:pointer; font-family:var(--font-mono); transition:all 0.1s; }
.source-toggle-btn:first-child { border-right:1px solid var(--border2); }
.source-toggle-btn.active { background:var(--accent); color:var(--bg); }
.source-toggle-btn:hover:not(.active) { color:var(--text); }
/* Upload area */
.upload-area { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer; border:2px dashed var(--border2); border-radius:8px; padding:24px; margin:16px; transition:all 0.15s; color:var(--muted2); text-align:center; }
.upload-area:hover { border-color:var(--accent); color:var(--text); background:rgba(245,166,35,0.03); }
.upload-area .big { font-size:28px; opacity:0.4; }
.upload-area input { display:none; }
/* Live pane view toggle */
.view-toggle { display:flex; border:1px solid var(--border2); border-radius:3px; overflow:hidden; }
.view-toggle-btn { background:var(--bg3); color:var(--muted2); font-size:9px; padding:2px 6px; border:none; cursor:pointer; font-family:var(--font-mono); transition:all 0.1s; }
.view-toggle-btn:not(:last-child) { border-right:1px solid var(--border2); }
.view-toggle-btn.active { background:var(--blue); color:#fff; }
.view-toggle-btn:hover:not(.active) { color:var(--text); }
.pane-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--muted); font-size:11px; text-align:center; }
.pane-empty .big { font-size:28px; margin-bottom:4px; opacity:0.4; }

/* Scanning animation */
@keyframes scan { from{transform:translateY(0);opacity:0.7} to{transform:translateY(100%);opacity:0} }
.scan-line { position:absolute; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,var(--blue),transparent); animation:scan 2s ease-in-out infinite; pointer-events:none; display:none; }

/* VIOLATIONS VIEW (below comparison) */
.violations-bar { max-height:200px; overflow-y:auto; border-top:1px solid var(--border); background:var(--bg1); padding:8px 14px; display:none; }
.violations-bar.visible { display:block; }
.violations-bar::-webkit-scrollbar { width:3px; }
.violations-bar::-webkit-scrollbar-thumb { background:var(--border2); border-radius:3px; }
.violations-bar .dim-title { margin-bottom:6px; }
.violation-row { display:flex; gap:8px; padding:6px 8px; border-radius:4px; background:var(--bg2); border:1px solid var(--border); margin-bottom:4px; font-size:10px; }
.violation-row:hover { border-color:var(--border2); }
.v-icon { flex-shrink:0; }
.v-body { flex:1; }
.v-title { color:var(--text); margin-bottom:2px; }
.v-detail { color:var(--muted2); font-size:9px; }
.v-type { font-size:8px; padding:1px 4px; border-radius:3px; flex-shrink:0; font-weight:600; }
.vt-color { background:rgba(168,85,247,0.15); color:var(--purple); }
.vt-spacing { background:rgba(74,158,255,0.12); color:var(--blue); }
.vt-typography { background:rgba(245,166,35,0.12); color:var(--accent); }
.vt-border-radius { background:rgba(231,76,60,0.12); color:var(--red); }
.vt-shadow { background:rgba(90,96,117,0.2); color:var(--muted2); }

/* LOG VIEW */
.log-view { flex:1; overflow:hidden; display:flex; flex-direction:column; display:none; }
.log-view.visible { display:flex; }
.log-stream { flex:1; overflow-y:auto; padding:12px 16px; font-family:var(--font-mono); font-size:11px; line-height:1.7; }
.log-stream::-webkit-scrollbar { width:3px; }
.log-stream::-webkit-scrollbar-thumb { background:var(--border2); border-radius:3px; }
.log-line { display:flex; gap:10px; animation:slideIn 0.2s ease; }
.log-time { color:var(--muted); flex-shrink:0; }
.log-agent { flex-shrink:0; font-weight:600; color:var(--blue); }
.log-msg { color:var(--muted2); }
.log-msg.highlight { color:var(--text); }
.log-msg.warn { color:var(--accent); }
.log-msg.err { color:var(--red); }
.log-msg.success { color:var(--green); }
@keyframes slideIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

/* SCORE PANEL */
.score-panel { background:var(--bg1); border-left:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; backdrop-filter:var(--backdrop-blur); box-shadow:var(--shadow-sm); }
.score-header { padding:14px 16px; border-bottom:1px solid var(--border); background:var(--bg2); display:flex; align-items:center; justify-content:space-between; }
.score-title { font-family:var(--font-head); font-weight:700; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:var(--muted2); }
.score-body { flex:1; overflow-y:auto; padding:16px; }
.score-body::-webkit-scrollbar { width:3px; }
.score-body::-webkit-scrollbar-thumb { background:var(--border2); border-radius:3px; }
.gauge-wrap { text-align:center; margin-bottom:20px; }
.gauge-svg { width:140px; height:80px; }
.gauge-number { font-family:var(--font-head); font-size:32px; font-weight:800; color:var(--accent); line-height:1; margin-bottom:2px; }
.gauge-label { font-size:10px; color:var(--muted2); letter-spacing:0.08em; text-transform:uppercase; }
@keyframes scoreUp { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
.score-bump { animation:scoreUp 0.5s ease; }
.dim-title { font-family:var(--font-head); font-weight:700; font-size:10px; letter-spacing:0.06em; text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
.dim-row { margin-bottom:10px; }
.dim-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
.dim-name { font-size:11px; color:var(--muted2); }
.dim-val { font-size:11px; font-weight:600; }
.dim-bar { height:4px; background:var(--bg3); border-radius:2px; overflow:hidden; }
.dim-fill { height:100%; border-radius:2px; transition:width 1.2s cubic-bezier(.22,1,.36,1); }
.c-green { background:var(--green); } .c-amber { background:var(--accent); } .c-red { background:var(--red); }
.issues-section { margin-top:16px; border-top:1px solid var(--border); padding-top:14px; }
.issue-item { display:flex; gap:8px; padding:8px 10px; border-radius:6px; background:var(--bg2); border:1px solid var(--border); margin-bottom:6px; }
.issue-item:hover { border-color:var(--border2); }
.issue-icon { font-size:10px; padding-top:1px; flex-shrink:0; }
.issue-body { flex:1; }
.issue-title { font-size:11px; color:var(--text); margin-bottom:2px; line-height:1.3; }
.issue-detail { font-size:10px; color:var(--muted2); }
.issue-sev { font-size:9px; padding:1px 5px; border-radius:3px; flex-shrink:0; margin-top:1px; font-weight:600; }
.sev-high { background:rgba(231,76,60,0.15); color:var(--red); }
.sev-med { background:rgba(245,166,35,0.12); color:var(--accent); }
.sev-low { background:rgba(46,204,113,0.1); color:var(--green); }
</style>
</head>
<body>

<!-- TOP BAR -->
<div class="topbar" id="topbar">
  <div class="topbar-left">
    <div class="logo">Pixel<span>Proof</span></div>
    <div class="live-badge"><div class="live-dot"></div> <span id="conn-label">CONNECTING</span></div>
  </div>
  <div class="topbar-right">
    <div class="stat-pill">Components: <strong id="stat-total">0</strong></div>
    <div class="stat-pill">Rendered: <strong id="stat-rendered">0</strong></div>
    <div class="stat-pill">Violations: <strong id="stat-violations">0</strong></div>
    <div class="stat-pill">Avg compliance: <strong id="stat-compliance">-</strong></div>
    <button id="theme-toggle" onclick="toggleTheme()" title="Toggle Light/Dark Mode" style="margin-left:12px;background:none;border:none;cursor:pointer;font-size:16px;opacity:0.8;transition:transform 0.2s, opacity 0.2s;">☀️</button>
  </div>
</div>

<!-- LAYOUT -->
<div class="layout">

  <!-- SIDEBAR -->
  <div class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">Components</span>
      <span class="count-badge" id="comp-count">0</span>
    </div>
    <div class="component-list" id="component-list"></div>
  </div>

  <!-- MAIN: Comparison + Violations + Log -->
  <div class="main">
    <div class="main-header">
      <div class="main-header-top">
        <div>
          <div class="comp-full-file" id="full-file">Select a component</div>
          <div class="comp-full-name" id="full-name">PixelProof Dashboard</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="comp-status" id="full-status" style="display:none"></span>
        </div>
      </div>
      <div class="main-tabs">
        <div class="tab active" onclick="switchTab('compare',this)">Compare</div>
        <div class="tab" onclick="switchTab('log',this)">Event Log</div>
      </div>
    </div>

    <!-- Compare view (default) -->
    <div class="compare-view" id="compare-view">
      <div class="comparison-grid">
        <!-- Figma pane -->
        <div class="compare-pane">
          <div class="pane-header">
            <div class="pane-label"><div class="dot figma-dot"></div> Figma Design</div>
            <div style="display:flex;align-items:center;gap:6px">
              <div class="source-toggle" id="figma-source-toggle">
                <button class="source-toggle-btn active" onclick="setFigmaSource('upload')">Upload</button>
                <button class="source-toggle-btn" onclick="setFigmaSource('mcp')">MCP</button>
              </div>
              <div class="zoom-controls">
                <button class="zoom-btn" onclick="zoomPane('figma',-1)" title="Zoom out">-</button>
                <span class="zoom-label" id="figma-zoom-label">100%</span>
                <button class="zoom-btn" onclick="zoomPane('figma',1)" title="Zoom in">+</button>
                <button class="zoom-btn" onclick="zoomPane('figma',0)" title="Reset" style="font-size:9px;width:28px">FIT</button>
              </div>
              <span class="diff-badge diff-pass" id="figma-badge">BASELINE</span>
            </div>
          </div>
          <div class="pane-body checkerboard" id="figma-pane">
            <div class="upload-area" id="figma-upload" onclick="document.getElementById('figma-file-input').click()">
              <input type="file" id="figma-file-input" accept="image/*" onchange="handleFigmaUpload(this)">
              <div class="big">&#128247;</div>
              <div>Drop or click to upload Figma screenshot</div>
              <div style="font-size:9px;color:var(--muted)">PNG, JPG — paste from clipboard with Ctrl+V</div>
            </div>
          </div>
        </div>
        <!-- Live render pane -->
        <div class="compare-pane">
          <div class="pane-header">
            <div class="pane-label"><div class="dot live-dot2"></div> Live Render</div>
            <div style="display:flex;align-items:center;gap:6px">
              <div class="view-toggle" id="live-view-toggle">
                <button class="view-toggle-btn active" onclick="setLiveView('live')" title="Live iframe">Live</button>
                <button class="view-toggle-btn" onclick="setLiveView('screenshot')" title="Captured screenshot">Screenshot</button>
                <button class="view-toggle-btn" onclick="setLiveView('diff')" title="Pixel diff">Diff</button>
              </div>
              <div class="zoom-controls">
                <button class="zoom-btn" onclick="zoomPane('live',-1)" title="Zoom out">-</button>
                <span class="zoom-label" id="live-zoom-label">100%</span>
                <button class="zoom-btn" onclick="zoomPane('live',1)" title="Zoom in">+</button>
                <button class="zoom-btn" onclick="zoomPane('live',0)" title="Reset" style="font-size:9px;width:28px">FIT</button>
              </div>
              <select class="viewport-select" id="viewport-select" onchange="changeViewport(this.value)" title="Viewport size">
                <option value="360x640">Mobile 360</option>
                <option value="375x812">iPhone 375</option>
                <option value="768x1024">Tablet 768</option>
                <option value="1024x768">Desktop 1024</option>
                <option value="1280x800" selected>Desktop 1280</option>
                <option value="1440x900">Desktop 1440</option>
              </select>
              <span class="diff-badge" id="diff-badge" style="display:none"></span>
            </div>
          </div>
          <div class="pane-body checkerboard" id="live-pane">
            <div class="scan-line" id="scan-line"></div>
            <div class="pane-empty" id="live-empty">
              <div class="big">&#9654;</div>
              <div>Select a component to preview</div>
              <div style="font-size:9px;color:var(--muted)">The component will render via the harness</div>
            </div>
          </div>
        </div>
      </div>
      <!-- Violations bar below comparison -->
      <div class="violations-bar" id="violations-bar">
        <div class="dim-title">Detected Issues</div>
        <div id="violations-list"></div>
      </div>
    </div>

    <!-- Log view -->
    <div class="log-view" id="log-view">
      <div class="log-stream" id="log-stream"></div>
    </div>
  </div>

  <!-- SCORE PANEL -->
  <div class="score-panel">
    <div class="score-header">
      <span class="score-title">Confidence Score</span>
      <span id="score-time" style="font-size:9px;color:var(--muted)">waiting...</span>
    </div>
    <div class="score-body">
      <div class="gauge-wrap">
        <svg class="gauge-svg" viewBox="0 0 140 80">
          <path d="M 20 75 A 50 50 0 0 1 120 75" fill="none" stroke="#1f232e" stroke-width="10" stroke-linecap="round"/>
          <path id="gauge-arc" d="M 20 75 A 50 50 0 0 1 120 75" fill="none" stroke="var(--muted)" stroke-width="10" stroke-linecap="round"
            stroke-dasharray="157" stroke-dashoffset="157" style="transition:stroke-dashoffset 1s ease,stroke 0.5s ease"/>
        </svg>
        <div class="gauge-number" id="score-display">-</div>
        <div class="gauge-label">Token Compliance</div>
      </div>

      <div class="dim-title">Per-Component Scores</div>
      <div id="dim-rows"></div>

      <div class="issues-section">
        <div class="dim-title" style="margin-bottom:10px">Recent Violations</div>
        <div id="issues-list">
          <div style="font-size:10px;color:var(--muted)">No violations yet</div>
        </div>
      </div>
    </div>
  </div>

</div>

<script>
// ---- STATE ----
var components = [];
var aggregate = { tokenCompliance:0, renderFidelity:0, totalComponents:0, renderedComponents:0, skippedComponents:0, totalViolations:0 };
var selectedFile = null;
var ws = null;

// ---- THEME LOGIC ----
var savedTheme = localStorage.getItem('pixelproof-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
document.getElementById('theme-toggle').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
function toggleTheme() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var nextTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nextTheme);
  localStorage.setItem('pixelproof-theme', nextTheme);
  document.getElementById('theme-toggle').textContent = nextTheme === 'dark' ? '☀️' : '🌙';
  var toggleBtn = document.getElementById('theme-toggle');
  toggleBtn.style.transform = 'scale(0.8)';
  setTimeout(function() { toggleBtn.style.transform = 'scale(1)'; }, 150);
}

function scoreColor(s) { return s >= 85 ? 'var(--green)' : s >= 65 ? 'var(--accent)' : 'var(--red)'; }
function scoreClass(s) { return s >= 85 ? 'c-green' : s >= 65 ? 'c-amber' : 'c-red'; }
function shortFile(f) {
  var parts = f.replace(/\\\\/g,'/').split('/');
  return parts.length > 2 ? parts.slice(-2).join('/') : parts[parts.length-1];
}
function exportName(c) {
  if (!c.exports || c.exports.length === 0) return shortFile(c.file);
  return c.exports[0] === 'default' ? shortFile(c.file) : c.exports[0];
}
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ---- RENDER SIDEBAR ----
function renderSidebar() {
  var list = document.getElementById('component-list');
  document.getElementById('comp-count').textContent = components.length;
  if (components.length === 0) {
    list.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:10px;text-align:center">No components scanned yet</div>';
    return;
  }
  list.innerHTML = components.map(function(c) {
    var tc = c.tokenCompliance != null ? c.tokenCompliance : 0;
    var active = c.file === selectedFile ? ' active' : '';
    var statusCls = 'status-' + c.renderStatus;
    var statusLabel = c.renderStatus.charAt(0).toUpperCase() + c.renderStatus.slice(1);
    return '<div class="comp-card' + active + '" onclick="selectComponent(\\'' + escapeHtml(c.file).replace(/'/g,"\\\\'") + '\\')">' +
      '<div class="comp-card-top"><span class="comp-file" title="' + escapeHtml(c.file) + '">' + shortFile(c.file) + '</span>' +
      '<span class="comp-status ' + statusCls + '">' + statusLabel + '</span></div>' +
      '<div class="comp-name">' + escapeHtml(exportName(c)) + '</div>' +
      '<div class="comp-meta">' +
      '<span class="comp-agent">Scanner</span>' +
      '<div class="score-mini"><div class="score-bar-mini"><div class="score-bar-fill" style="width:' + tc + '%;background:' + scoreColor(tc) + '"></div></div>' +
      '<span style="color:' + scoreColor(tc) + '">' + tc + '%</span></div>' +
      (c.violations.length > 0 ? '<span class="violation-count">' + c.violations.length + '</span>' : '') +
      '</div></div>';
  }).join('');
}

// ---- SELECT COMPONENT ----
function selectComponent(file) {
  selectedFile = file;
  var comp = components.find(function(c) { return c.file === file; });
  if (!comp) return;
  document.getElementById('full-file').textContent = comp.file;
  document.getElementById('full-name').textContent = exportName(comp);
  var st = document.getElementById('full-status');
  st.style.display = '';
  st.className = 'comp-status status-' + comp.renderStatus;
  st.textContent = comp.renderStatus;

  renderSidebar();
  renderLivePane(comp);
  renderFigmaPane();
  renderViolationsBar(comp);
  renderScorePanel(comp);
  addLog('[UI]', 'Selected ' + shortFile(comp.file), '');
}

// ---- LIVE RENDER PANE ----
// ---- ZOOM STATE ----
var zoomLevels = { figma: 100, live: 100 };
var viewport = { w: 1280, h: 800 };

function renderLivePane(comp) {
  var pane = document.getElementById('live-pane');
  var badge = document.getElementById('diff-badge');

  if (!comp) {
    pane.innerHTML = '<div class="scan-line" id="scan-line" style="display:none"></div>' +
      '<div class="pane-empty"><div class="big">&#9654;</div><div>Select a component to preview</div></div>';
    badge.style.display = 'none';
    return;
  }

  var scale = zoomLevels.live / 100;
  var compName = deriveComponentName(comp.file);

  if (liveView === 'screenshot') {
    // Show captured Playwright screenshot
    var img = new Image();
    img.onload = function() {
      var imgW = img.naturalWidth, imgH = img.naturalHeight;
      var sW = Math.round(imgW * scale), sH = Math.round(imgH * scale);
      pane.innerHTML = '<div class="scan-line" id="scan-line"></div>' +
        '<div id="live-wrapper" style="width:' + sW + 'px;height:' + sH + 'px;overflow:hidden;flex-shrink:0;"></div>';
      img.id = 'live-screenshot';
      img.style.transform = 'scale(' + scale + ')';
      img.style.transformOrigin = '0 0';
      img.style.maxWidth = 'none';
      document.getElementById('live-wrapper').appendChild(img);
    };
    img.onerror = function() {
      pane.innerHTML = '<div class="scan-line" id="scan-line" style="display:none"></div>' +
        '<div class="pane-empty"><div class="big">&#128247;</div>' +
        '<div>No screenshot for ' + escapeHtml(compName) + '</div>' +
        '<div style="font-size:9px;color:var(--muted)">Run the render pipeline to capture screenshots</div></div>';
    };
    img.src = '/api/screenshot/' + encodeURIComponent(compName) + '?t=' + Date.now();
  } else if (liveView === 'diff') {
    // Show pixel diff image
    var diffImg = new Image();
    diffImg.onload = function() {
      var imgW = diffImg.naturalWidth, imgH = diffImg.naturalHeight;
      var sW = Math.round(imgW * scale), sH = Math.round(imgH * scale);
      pane.innerHTML = '<div class="scan-line" id="scan-line"></div>' +
        '<div id="live-wrapper" style="width:' + sW + 'px;height:' + sH + 'px;overflow:hidden;flex-shrink:0;"></div>';
      diffImg.id = 'live-screenshot';
      diffImg.style.transform = 'scale(' + scale + ')';
      diffImg.style.transformOrigin = '0 0';
      diffImg.style.maxWidth = 'none';
      document.getElementById('live-wrapper').appendChild(diffImg);
    };
    diffImg.onerror = function() {
      pane.innerHTML = '<div class="scan-line" id="scan-line" style="display:none"></div>' +
        '<div class="pane-empty"><div class="big">&#128308;</div>' +
        '<div>No diff for ' + escapeHtml(compName) + '</div>' +
        '<div style="font-size:9px;color:var(--muted)">Upload a baseline and run the render pipeline to generate diffs</div></div>';
    };
    diffImg.src = '/api/diff/' + encodeURIComponent(compName) + '?t=' + Date.now();
  } else {
    // Live iframe mode — wrap in a sized container so flex centering works with scale
    var exportN = (comp.exports && comp.exports.length > 0) ? comp.exports[0] : 'default';
    var harnessUrl = '/harness?component=' + encodeURIComponent(comp.file) + '&export=' + encodeURIComponent(exportN);
    var scaledW = Math.round(viewport.w * scale);
    var scaledH = Math.round(viewport.h * scale);
    pane.innerHTML = '<div class="scan-line" id="scan-line"></div>' +
      '<div id="live-wrapper" style="width:' + scaledW + 'px;height:' + scaledH + 'px;overflow:hidden;flex-shrink:0;">' +
      '<iframe id="live-iframe" src="' + harnessUrl + '" title="Live render of ' + escapeHtml(exportName(comp)) + '"' +
      ' style="width:' + viewport.w + 'px;height:' + viewport.h + 'px;transform:scale(' + scale + ');transform-origin:0 0;"></iframe></div>';
  }

  // Show scan briefly
  var sl = document.getElementById('scan-line');
  if (sl) { sl.style.display = 'block'; setTimeout(function() { sl.style.display = 'none'; }, 2000); }

  // Update diff badge
  var vCount = comp.violations.length;
  if (vCount === 0) {
    badge.style.display = '';
    badge.textContent = 'PASS';
    badge.className = 'diff-badge diff-pass';
  } else {
    badge.style.display = '';
    badge.textContent = vCount + ' DIFF' + (vCount > 1 ? 'S' : '');
    badge.className = 'diff-badge ' + (vCount > 3 ? 'diff-fail' : 'diff-warn');
  }
}

// ---- ZOOM CONTROLS ----
var MIN_ZOOM = 10, MAX_ZOOM = 400;

function setZoom(paneId, level) {
  zoomLevels[paneId] = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(level)));
  document.getElementById(paneId + '-zoom-label').textContent = zoomLevels[paneId] + '%';
  applyZoom(paneId);
}

function zoomPane(paneId, dir) {
  if (dir === 0) {
    // Fit: scale so content fits in pane width
    var paneEl = document.getElementById(paneId === 'figma' ? 'figma-pane' : 'live-pane');
    var fitScale = Math.min(paneEl.clientWidth / viewport.w, paneEl.clientHeight / viewport.h) * 100;
    setZoom(paneId, fitScale);
  } else {
    // Step through discrete levels for button clicks
    var steps = [10, 25, 50, 75, 100, 125, 150, 200, 300, 400];
    var cur = zoomLevels[paneId];
    var idx = steps.reduce(function(best,v,i) { return Math.abs(v-cur) < Math.abs(steps[best]-cur) ? i : best; }, 0);
    var next = Math.max(0, Math.min(steps.length-1, idx + dir));
    setZoom(paneId, steps[next]);
  }
}

function applyZoom(paneId) {
  var scale = zoomLevels[paneId] / 100;
  if (paneId === 'live') {
    var iframe = document.getElementById('live-iframe');
    var wrapper = document.getElementById('live-wrapper');
    if (iframe) {
      iframe.style.transform = 'scale(' + scale + ')';
      iframe.style.width = viewport.w + 'px';
      iframe.style.height = viewport.h + 'px';
    }
    var liveImg = document.getElementById('live-screenshot');
    if (liveImg) {
      liveImg.style.transform = 'scale(' + scale + ')';
      liveImg.style.transformOrigin = '0 0';
      // Resize wrapper to match scaled image dimensions
      var natW = liveImg.naturalWidth || viewport.w;
      var natH = liveImg.naturalHeight || viewport.h;
      if (wrapper) {
        wrapper.style.width = Math.round(natW * scale) + 'px';
        wrapper.style.height = Math.round(natH * scale) + 'px';
      }
    }
    if (wrapper && iframe) {
      wrapper.style.width = Math.round(viewport.w * scale) + 'px';
      wrapper.style.height = Math.round(viewport.h * scale) + 'px';
    }
  }
  if (paneId === 'figma') {
    var img = document.querySelector('#figma-pane img');
    if (img) {
      img.style.transform = 'scale(' + scale + ')';
      img.style.transformOrigin = '0 0';
    }
  }
}

function changeViewport(val) {
  var parts = val.split('x');
  viewport.w = parseInt(parts[0]);
  viewport.h = parseInt(parts[1]);
  if (selectedFile) {
    var comp = components.find(function(c) { return c.file === selectedFile; });
    if (comp) renderLivePane(comp);
  }
}

// ---- PINCH & CTRL+WHEEL ZOOM ----
function identifyPane(el) {
  while (el) {
    if (el.id === 'figma-pane') return 'figma';
    if (el.id === 'live-pane') return 'live';
    el = el.parentElement;
  }
  return null;
}

// Ctrl+Wheel or trackpad pinch (which fires wheel with ctrlKey=true)
document.addEventListener('wheel', function(e) {
  var paneId = identifyPane(e.target);
  if (!paneId) return;
  if (!e.ctrlKey && !e.metaKey) return; // Only zoom on Ctrl/Cmd+wheel or pinch
  e.preventDefault();
  var delta = -e.deltaY;
  var factor = 1 + delta * 0.01; // Smooth continuous zoom
  setZoom(paneId, zoomLevels[paneId] * factor);
}, { passive: false });

// Touch pinch gesture
var pinchState = {};
document.addEventListener('touchstart', function(e) {
  if (e.touches.length === 2) {
    var paneId = identifyPane(e.target);
    if (!paneId) return;
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    pinchState = { paneId: paneId, startDist: Math.hypot(dx, dy), startZoom: zoomLevels[paneId] };
  }
}, { passive: true });

document.addEventListener('touchmove', function(e) {
  if (e.touches.length === 2 && pinchState.paneId) {
    e.preventDefault();
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    var dist = Math.hypot(dx, dy);
    var ratio = dist / pinchState.startDist;
    setZoom(pinchState.paneId, pinchState.startZoom * ratio);
  }
}, { passive: false });

document.addEventListener('touchend', function() { pinchState = {}; }, { passive: true });

// ---- FIGMA PANE (placeholder for now, shows screenshot if available) ----
// ---- FIGMA SOURCE TOGGLE ----
var figmaSource = 'upload'; // 'upload' or 'mcp'
var liveView = 'live'; // 'live', 'screenshot', or 'diff'

function setFigmaSource(mode) {
  figmaSource = mode;
  var btns = document.querySelectorAll('#figma-source-toggle .source-toggle-btn');
  btns.forEach(function(b) { b.classList.toggle('active', b.textContent.toLowerCase() === mode); });
  renderFigmaPane();
}

function setLiveView(mode) {
  liveView = mode;
  var btns = document.querySelectorAll('#live-view-toggle .view-toggle-btn');
  btns.forEach(function(b) { b.classList.toggle('active', b.textContent.toLowerCase() === mode); });
  if (selectedFile) {
    var comp = components.find(function(c) { return c.file === selectedFile; });
    if (comp) renderLivePane(comp);
  }
}

function renderFigmaPane() {
  var pane = document.getElementById('figma-pane');
  if (!selectedFile) {
    showFigmaUploadArea(pane);
    return;
  }
  var compName = deriveComponentName(selectedFile);

  if (figmaSource === 'mcp') {
    // MCP mode: try to load baseline from API
    var img = new Image();
    img.onload = function() {
      var scale = zoomLevels.figma / 100;
      pane.innerHTML = '';
      img.style.transform = 'scale(' + scale + ')';
      img.style.transformOrigin = '0 0';
      img.style.maxWidth = 'none';
      pane.appendChild(img);
      document.getElementById('figma-badge').textContent = 'MCP';
      document.getElementById('figma-badge').className = 'diff-badge diff-pass';
    };
    img.onerror = function() {
      pane.innerHTML = '<div class="pane-empty"><div class="big">&#128279;</div>' +
        '<div>No MCP baseline for ' + escapeHtml(compName) + '</div>' +
        '<div style="font-size:9px;color:var(--muted)">Configure figma.nodeIds in .pixelproofrc to fetch from Figma</div></div>';
      document.getElementById('figma-badge').textContent = 'NO DATA';
      document.getElementById('figma-badge').className = 'diff-badge diff-warn';
    };
    img.src = '/api/baseline/' + encodeURIComponent(compName) + '?t=' + Date.now();
  } else {
    // Upload mode: check if baseline exists, else show upload area
    var img2 = new Image();
    img2.onload = function() {
      var scale = zoomLevels.figma / 100;
      pane.innerHTML = '';
      img2.style.transform = 'scale(' + scale + ')';
      img2.style.transformOrigin = '0 0';
      img2.style.maxWidth = 'none';
      img2.style.cursor = 'pointer';
      img2.title = 'Click to replace';
      img2.onclick = function() { document.getElementById('figma-file-input').click(); };
      pane.appendChild(img2);
      // Add a small re-upload button
      var reupload = document.createElement('div');
      reupload.style.cssText = 'position:absolute;bottom:8px;right:8px;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;padding:3px 8px;font-size:9px;color:var(--muted2);cursor:pointer;z-index:2;';
      reupload.textContent = 'Replace';
      reupload.onclick = function() { document.getElementById('figma-file-input').click(); };
      pane.appendChild(reupload);
      // Keep the hidden file input
      var inp = document.createElement('input');
      inp.type = 'file'; inp.id = 'figma-file-input'; inp.accept = 'image/*'; inp.style.display = 'none';
      inp.onchange = function() { handleFigmaUpload(inp); };
      pane.appendChild(inp);
      document.getElementById('figma-badge').textContent = 'UPLOADED';
      document.getElementById('figma-badge').className = 'diff-badge diff-pass';
    };
    img2.onerror = function() {
      showFigmaUploadArea(pane);
      document.getElementById('figma-badge').textContent = 'BASELINE';
      document.getElementById('figma-badge').className = 'diff-badge diff-warn';
    };
    img2.src = '/api/baseline/' + encodeURIComponent(compName) + '?t=' + Date.now();
  }
}

function showFigmaUploadArea(pane) {
  pane.innerHTML = '<div class="upload-area" id="figma-upload" onclick="document.getElementById(\\'figma-file-input\\').click()">' +
    '<input type="file" id="figma-file-input" accept="image/*" onchange="handleFigmaUpload(this)" style="display:none">' +
    '<div class="big">&#128247;</div>' +
    '<div>Drop or click to upload Figma screenshot</div>' +
    '<div style="font-size:9px;color:var(--muted)">PNG, JPG &mdash; or paste from clipboard with Ctrl+V</div></div>';
}

function handleFigmaUpload(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (!selectedFile) { addLog('[UI]', 'Select a component first', 'warn'); return; }
  uploadBaselineFile(file);
}

function uploadBaselineFile(file) {
  var compName = deriveComponentName(selectedFile);
  var reader = new FileReader();
  reader.onload = function() {
    var arrayBuf = reader.result;
    fetch('/api/baseline/' + encodeURIComponent(compName), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: arrayBuf
    }).then(function(res) { return res.json(); }).then(function() {
      addLog('[FIGMA]', 'Uploaded baseline for ' + compName, 'success');
      renderFigmaPane();
    }).catch(function(err) {
      addLog('[FIGMA]', 'Upload failed: ' + err.message, 'err');
    });
  };
  reader.readAsArrayBuffer(file);
}

function deriveComponentName(file) {
  var parts = file.replace(/\\\\/g, '/').split('/');
  var base = parts[parts.length - 1];
  return base.replace(/\\.(tsx?|jsx?)$/, '');
}

// ---- CLIPBOARD PASTE (Ctrl+V) ----
document.addEventListener('paste', function(e) {
  if (!selectedFile) return;
  var items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault();
      var blob = items[i].getAsFile();
      if (blob) uploadBaselineFile(blob);
      return;
    }
  }
});

// ---- DRAG & DROP on Figma pane ----
document.addEventListener('dragover', function(e) {
  var paneId = identifyPane(e.target);
  if (paneId === 'figma') { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
});
document.addEventListener('drop', function(e) {
  var paneId = identifyPane(e.target);
  if (paneId !== 'figma') return;
  e.preventDefault();
  if (!selectedFile) { addLog('[UI]', 'Select a component first', 'warn'); return; }
  var file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.type.indexOf('image') !== -1) {
    uploadBaselineFile(file);
  }
});

// ---- VIOLATIONS BAR ----
function renderViolationsBar(comp) {
  var bar = document.getElementById('violations-bar');
  var list = document.getElementById('violations-list');
  if (!comp || comp.violations.length === 0) {
    bar.classList.remove('visible');
    return;
  }
  bar.classList.add('visible');
  list.innerHTML = comp.violations.map(function(v) {
    var icon = v.confidence === 'exact' ? '&#10060;' : '&#9888;';
    var iconColor = v.confidence === 'exact' ? 'var(--red)' : 'var(--accent)';
    return '<div class="violation-row">' +
      '<div class="v-icon" style="color:' + iconColor + '">' + icon + '</div>' +
      '<div class="v-body"><div class="v-title">' + escapeHtml(v.prop) + ': ' + escapeHtml(v.found) + '</div>' +
      '<div class="v-detail">Expected: ' + escapeHtml(v.figmaToken) + ' (' + escapeHtml(v.resolvedValue) + ') &middot; Line ' + v.line + '</div></div>' +
      '<span class="v-type vt-' + v.type + '">' + v.type.toUpperCase() + '</span></div>';
  }).join('');
}

// ---- RENDER SCORE PANEL ----
function renderScorePanel(comp) {
  var display = document.getElementById('score-display');
  var arc = document.getElementById('gauge-arc');
  var score = comp ? (comp.tokenCompliance != null ? comp.tokenCompliance : 0) : aggregate.tokenCompliance;
  display.textContent = Math.round(score);
  display.classList.add('score-bump');
  setTimeout(function() { display.classList.remove('score-bump'); }, 500);
  var offset = 157 - (score / 100) * 157;
  arc.style.strokeDashoffset = offset;
  arc.style.stroke = score > 0 ? scoreColor(score) : 'var(--muted)';

  // Per-component bars
  var dimRows = document.getElementById('dim-rows');
  var sorted = components.slice().sort(function(a,b) { return (a.tokenCompliance||0) - (b.tokenCompliance||0); });
  dimRows.innerHTML = sorted.slice(0, 8).map(function(c) {
    var tc = c.tokenCompliance != null ? c.tokenCompliance : 0;
    var highlight = c.file === selectedFile ? 'color:var(--text);' : '';
    return '<div class="dim-row"><div class="dim-top"><span class="dim-name" style="' + highlight + '">' + shortFile(c.file) + '</span>' +
      '<span class="dim-val" style="color:' + scoreColor(tc) + '">' + tc + '%</span></div>' +
      '<div class="dim-bar"><div class="dim-fill ' + scoreClass(tc) + '" style="width:' + tc + '%"></div></div></div>';
  }).join('');

  // Recent violations
  var allV = [];
  components.forEach(function(c) { c.violations.forEach(function(v) { allV.push(v); }); });
  var issuesList = document.getElementById('issues-list');
  if (allV.length === 0) {
    issuesList.innerHTML = '<div style="font-size:10px;color:var(--muted)">No violations detected</div>';
  } else {
    issuesList.innerHTML = allV.slice(0,5).map(function(v) {
      var sev = v.confidence === 'exact' ? 'sev-high' : 'sev-med';
      var sevLabel = v.confidence === 'exact' ? 'HIGH' : 'MED';
      var icon = v.confidence === 'exact' ? '&#10060;' : '&#9888;';
      var iconColor = v.confidence === 'exact' ? 'var(--red)' : 'var(--accent)';
      return '<div class="issue-item"><div class="issue-icon" style="color:' + iconColor + '">' + icon + '</div>' +
        '<div class="issue-body"><div class="issue-title">' + escapeHtml(v.prop) + ': ' + escapeHtml(v.found) + '</div>' +
        '<div class="issue-detail">' + shortFile(v.file) + ':' + v.line + '</div></div>' +
        '<div class="issue-sev ' + sev + '">' + sevLabel + '</div></div>';
    }).join('');
  }
}

// ---- UPDATE AGGREGATE STATS ----
function updateStats() {
  document.getElementById('stat-total').textContent = aggregate.totalComponents;
  document.getElementById('stat-rendered').textContent = aggregate.renderedComponents;
  document.getElementById('stat-violations').textContent = aggregate.totalViolations;
  document.getElementById('stat-compliance').textContent = aggregate.tokenCompliance > 0 ? aggregate.tokenCompliance + '%' : '-';
}

// ---- TAB SWITCH ----
function switchTab(tab, el) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('compare-view').classList.toggle('hidden', tab !== 'compare');
  document.getElementById('log-view').classList.toggle('visible', tab === 'log');
}

// ---- EVENT LOG ----
function addLog(agent, msg, cls) {
  var stream = document.getElementById('log-stream');
  var now = new Date();
  var time = ('0'+now.getHours()).slice(-2) + ':' + ('0'+now.getMinutes()).slice(-2) + ':' + ('0'+now.getSeconds()).slice(-2);
  var div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = '<span class="log-time">' + time + '</span><span class="log-agent">' + agent + '</span><span class="log-msg ' + (cls||'') + '">' + escapeHtml(msg) + '</span>';
  stream.appendChild(div);
  if (stream.children.length > 200) stream.removeChild(stream.firstChild);
  stream.scrollTop = stream.scrollHeight;
}

// ---- WEBSOCKET ----
function connect() {
  var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(proto + '//' + location.host + '/__pixelproof_ws');

  ws.onopen = function() {
    document.getElementById('topbar').classList.remove('disconnected');
    document.getElementById('conn-label').textContent = 'LIVE';
    addLog('[WS]', 'Connected to PixelProof server', 'success');
    document.getElementById('score-time').textContent = 'connected';
  };
  ws.onmessage = function(evt) {
    try { handleMessage(JSON.parse(evt.data)); } catch(e) {}
  };
  ws.onclose = function() {
    document.getElementById('topbar').classList.add('disconnected');
    document.getElementById('conn-label').textContent = 'DISCONNECTED';
    addLog('[WS]', 'Disconnected. Reconnecting in 3s...', 'err');
    setTimeout(connect, 3000);
  };
  ws.onerror = function() { ws.close(); };
}

function handleMessage(msg) {
  if (msg.type === 'initial-state') {
    components = msg.data.components || [];
    aggregate = msg.data.aggregate || aggregate;
    addLog('[SCAN]', 'Received ' + components.length + ' components', 'highlight');
    renderSidebar();
    updateStats();
    if (components.length > 0 && !selectedFile) {
      selectComponent(components[0].file);
    } else if (selectedFile) {
      var comp = components.find(function(c) { return c.file === selectedFile; });
      if (comp) { renderLivePane(comp); renderViolationsBar(comp); renderScorePanel(comp); }
    }
    document.getElementById('score-time').textContent = 'updated just now';
  }
  if (msg.type === 'score-update') {
    var updated = msg.data;
    var idx = components.findIndex(function(c) { return c.file === updated.file; });
    if (idx >= 0) { components[idx] = updated; } else { components.push(updated); }
    addLog('[SCORE]', shortFile(updated.file) + ' \\u2192 ' + (updated.tokenCompliance != null ? updated.tokenCompliance + '%' : 'pending'),
      updated.violations.length > 0 ? 'warn' : 'success');
    renderSidebar();
    if (selectedFile === updated.file) {
      renderLivePane(updated); renderViolationsBar(updated); renderScorePanel(updated);
    }
    document.getElementById('score-time').textContent = 'updated just now';
  }
  if (msg.type === 'aggregate-update') {
    aggregate = msg.data;
    updateStats();
  }
}

// ---- INIT ----
connect();
setInterval(function() {
  var el = document.getElementById('score-time');
  if (el.textContent === 'updated just now') {
    setTimeout(function() { el.textContent = 'updated 2s ago'; }, 2000);
  }
}, 5000);
</script>
</body>
</html>`;

