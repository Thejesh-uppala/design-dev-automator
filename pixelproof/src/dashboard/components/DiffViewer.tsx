import React, { useState } from 'react';
import type { RenderStatus } from '../../scoring/types.js';

interface DiffViewerProps {
  componentName: string;
  renderStatus: RenderStatus;
  renderFidelity: number | null;
}

export function DiffViewer({
  componentName,
  renderStatus,
  renderFidelity,
}: DiffViewerProps) {
  const [showDiff, setShowDiff] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const cacheBust = `?t=${Date.now()}`;

  const screenshotUrl = `/api/screenshot/${encodeURIComponent(componentName)}${cacheBust}`;
  const baselineUrl = `/api/baseline/${encodeURIComponent(componentName)}${cacheBust}`;
  const diffUrl = `/api/diff/${encodeURIComponent(componentName)}${cacheBust}`;

  if (renderStatus === 'skipped') {
    return React.createElement(
      'div',
      { className: 'pp-card', style: { color: 'var(--text-muted)' } },
      'Render skipped — no Figma baseline mapped or props required.',
    );
  }

  if (renderStatus === 'error') {
    return React.createElement(
      'div',
      {
        className: 'pp-card',
        style: { color: 'var(--red)' },
      },
      'Render error — component could not be rendered.',
    );
  }

  if (renderStatus === 'pending') {
    return React.createElement(
      'div',
      { className: 'pp-card', style: { color: 'var(--text-muted)' } },
      'Waiting for render...',
    );
  }

  const handleImgError = (key: string) => {
    setImgErrors((prev) => ({ ...prev, [key]: true }));
  };

  return React.createElement(
    'div',
    null,
    renderFidelity !== null &&
      React.createElement(
        'div',
        { style: { marginBottom: 12, fontSize: 14, fontWeight: 600 } },
        `Render Fidelity: ${renderFidelity}%`,
      ),
    React.createElement(
      'div',
      { className: 'pp-diff-viewer' },
      React.createElement(
        'div',
        { className: 'pp-diff-panel' },
        React.createElement(
          'span',
          { className: 'pp-diff-label' },
          'Rendered',
        ),
        imgErrors['screenshot']
          ? React.createElement(
              'div',
              { className: 'pp-card', style: { color: 'var(--text-muted)' } },
              'No screenshot available',
            )
          : React.createElement('img', {
              className: 'pp-diff-img',
              src: screenshotUrl,
              alt: `${componentName} rendered`,
              onError: () => handleImgError('screenshot'),
            }),
      ),
      React.createElement(
        'div',
        { className: 'pp-diff-panel' },
        React.createElement(
          'span',
          { className: 'pp-diff-label' },
          'Figma Baseline',
        ),
        imgErrors['baseline']
          ? React.createElement(
              'div',
              { className: 'pp-card', style: { color: 'var(--text-muted)' } },
              'No Figma baseline mapped',
            )
          : React.createElement('img', {
              className: 'pp-diff-img',
              src: baselineUrl,
              alt: `${componentName} baseline`,
              onError: () => handleImgError('baseline'),
            }),
      ),
    ),
    React.createElement(
      'div',
      { style: { marginTop: 12 } },
      React.createElement(
        'button',
        {
          className: 'pp-btn',
          onClick: () => setShowDiff(!showDiff),
        },
        showDiff ? 'Hide Diff Overlay' : 'Show Diff Overlay',
      ),
      showDiff &&
        React.createElement(
          'div',
          {
            style: {
              marginTop: 12,
              position: 'relative',
              display: 'inline-block',
            },
          },
          React.createElement('img', {
            className: 'pp-diff-img',
            src: screenshotUrl,
            alt: 'Screenshot',
            style: { display: 'block' },
          }),
          React.createElement('img', {
            className: 'pp-diff-img',
            src: diffUrl,
            alt: 'Diff overlay',
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              opacity: 0.5,
              mixBlendMode: 'multiply',
              transition: 'opacity 0.3s',
            },
          }),
        ),
    ),
  );
}
