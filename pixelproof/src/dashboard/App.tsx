import React from 'react';
import { useRoute, navigate } from './router.js';
import { ScoreProvider, useScore } from './contexts/ScoreContext.js';
import { OverviewPanel } from './components/OverviewPanel.js';
import { ComponentList } from './components/ComponentList.js';
import { ComponentDetail } from './pages/ComponentDetail.js';
import { TokenReference } from './pages/TokenReference.js';
import './index.css';

function Header() {
  const { connected } = useScore();
  return React.createElement(
    'header',
    { className: 'pp-header' },
    React.createElement('span', { className: 'pp-header-brand' }, 'PixelProof'),
    React.createElement(
      'div',
      { className: 'pp-header-status' },
      React.createElement('span', {
        className: `pp-status-dot${!connected ? ' pp-status-dot--disconnected' : ''}`,
      }),
      connected ? 'Connected' : 'Disconnected',
    ),
  );
}

function Sidebar() {
  const { route } = useRoute();
  return React.createElement(
    'nav',
    { className: 'pp-sidebar' },
    React.createElement(
      'div',
      { className: 'pp-nav' },
      React.createElement(
        'button',
        {
          className: `pp-nav-item${route === 'overview' ? ' pp-nav-item--active' : ''}`,
          onClick: () => navigate('/'),
        },
        'Overview',
      ),
      React.createElement(
        'button',
        {
          className: `pp-nav-item${route === 'overview' ? '' : route === 'tokens' ? '' : ' pp-nav-item--active'}`,
          onClick: () => navigate('/'),
          style: { marginTop: 24, fontSize: 12, color: 'var(--text-muted)', cursor: 'default' },
        },
        'COMPONENTS',
      ),
      React.createElement(ComponentNav, null),
      React.createElement(
        'button',
        {
          className: `pp-nav-item${route === 'tokens' ? ' pp-nav-item--active' : ''}`,
          onClick: () => navigate('tokens'),
          style: { marginTop: 16 },
        },
        'Token Reference',
      ),
    ),
  );
}

function ComponentNav() {
  const { components } = useScore();
  const { route, params } = useRoute();

  return React.createElement(
    'div',
    null,
    ...components.slice(0, 50).map((c) => {
      const name =
        c.file.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') || c.file;
      const isActive =
        route === 'component' && params.file === c.file;
      const hasViolations = c.violations.length > 0;
      return React.createElement(
        'button',
        {
          key: c.file,
          className: `pp-nav-item${isActive ? ' pp-nav-item--active' : ''}`,
          onClick: () =>
            navigate(`component/${encodeURIComponent(c.file)}`),
          style: { paddingLeft: 32, fontSize: 13 },
        },
        React.createElement(
          'span',
          {
            style: {
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: hasViolations ? 'var(--red)' : 'var(--green)',
              flexShrink: 0,
            },
          },
        ),
        name,
      );
    }),
  );
}

function MainContent() {
  const { route, params } = useRoute();

  if (route === 'component' && params.file) {
    return React.createElement(ComponentDetail, { file: params.file });
  }
  if (route === 'tokens') {
    return React.createElement(TokenReference, null);
  }

  // Overview: show overview panel + component list
  return React.createElement(
    'div',
    null,
    React.createElement(OverviewPanel, null),
    React.createElement(
      'div',
      { className: 'pp-section', style: { marginTop: 24 } },
      React.createElement(
        'h2',
        { className: 'pp-section-title' },
        'Components',
      ),
      React.createElement(ComponentList, null),
    ),
  );
}

export function App() {
  return React.createElement(
    ScoreProvider,
    null,
    React.createElement(Header, null),
    React.createElement(
      'div',
      { className: 'pp-layout' },
      React.createElement(Sidebar, null),
      React.createElement(
        'main',
        { className: 'pp-main' },
        React.createElement(MainContent, null),
      ),
    ),
  );
}
