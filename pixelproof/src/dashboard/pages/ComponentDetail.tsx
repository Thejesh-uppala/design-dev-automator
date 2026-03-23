import React, { useState, useEffect } from 'react';
import { useScore } from '../contexts/ScoreContext.js';
import { navigate } from '../router.js';
import { ScoreGauge } from '../components/ScoreGauge.js';
import { ViolationList } from '../components/ViolationList.js';
import { CodePreview } from '../components/CodePreview.js';
import { DiffViewer } from '../components/DiffViewer.js';
import { RenderButton } from '../components/RenderButton.js';
import { HarnessIframe } from '../components/HarnessIframe.js';

interface ComponentDetailProps {
  file: string;
}

function deriveComponentName(file: string): string {
  const base = file.split('/').pop() || file;
  return base.replace(/\.(tsx?|jsx?)$/, '');
}

export function ComponentDetail({ file }: ComponentDetailProps) {
  const { components, sendRenderRequest } = useScore();
  const [source, setSource] = useState<string>('');
  const [scrollToLine, setScrollToLine] = useState<number | undefined>();
  const [isRendering, setIsRendering] = useState(false);

  const score = components.find((c) => c.file === file);
  const componentName = deriveComponentName(file);
  const exportName = score?.exports[0] || componentName;
  const port = Number(window.location.port) || 3001;

  useEffect(() => {
    fetch(`/api/source?file=${encodeURIComponent(file)}`)
      .then((r) => {
        if (r.ok) return r.text();
        return '';
      })
      .then(setSource)
      .catch(() => setSource(''));
  }, [file]);

  // Clear rendering state when score updates
  useEffect(() => {
    if (
      score?.renderStatus === 'rendered' ||
      score?.renderStatus === 'error'
    ) {
      setIsRendering(false);
    }
  }, [score?.renderStatus]);

  const handleRender = () => {
    setIsRendering(true);
    sendRenderRequest(file, exportName);
  };

  if (!score) {
    return React.createElement(
      'div',
      null,
      React.createElement(
        'button',
        { className: 'pp-btn', onClick: () => navigate('/') },
        '← Back',
      ),
      React.createElement(
        'div',
        { style: { marginTop: 24, color: 'var(--text-muted)' } },
        `Component not found: ${file}`,
      ),
    );
  }

  return React.createElement(
    'div',
    null,
    // Header
    React.createElement(
      'div',
      {
        className: 'pp-flex pp-items-center pp-justify-between',
        style: { marginBottom: 24 },
      },
      React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {
            className: 'pp-btn',
            onClick: () => navigate('/'),
            style: { marginBottom: 8 },
          },
          '← Back',
        ),
        React.createElement(
          'h2',
          { style: { fontSize: 24, fontWeight: 700 } },
          componentName,
        ),
        React.createElement(
          'div',
          { className: 'pp-comp-card-file' },
          file,
        ),
      ),
      React.createElement(
        'div',
        { className: 'pp-flex pp-gap-16' },
        React.createElement(ScoreGauge, {
          value: score.tokenCompliance,
          label: 'TC',
          size: 80,
        }),
        React.createElement(ScoreGauge, {
          value: score.renderFidelity,
          label: 'RF',
          size: 80,
        }),
        React.createElement(RenderButton, {
          file,
          exportName,
          renderStatus: score.renderStatus,
          isRendering,
          onRender: handleRender,
        }),
      ),
    ),
    // Violations
    React.createElement(
      'div',
      { className: 'pp-section' },
      React.createElement(
        'h3',
        { className: 'pp-section-title' },
        `Violations (${score.violations.length})`,
      ),
      React.createElement(
        'div',
        { className: 'pp-card' },
        React.createElement(ViolationList, {
          violations: score.violations,
          onClickViolation: setScrollToLine,
        }),
      ),
    ),
    // Code Preview
    source &&
      React.createElement(
        'div',
        { className: 'pp-section' },
        React.createElement(
          'h3',
          { className: 'pp-section-title' },
          'Source Code',
        ),
        React.createElement(CodePreview, {
          source,
          violations: score.violations,
          scrollToLine,
        }),
      ),
    // Diff Viewer
    React.createElement(
      'div',
      { className: 'pp-section' },
      React.createElement(
        'h3',
        { className: 'pp-section-title' },
        'Render Comparison',
      ),
      React.createElement(DiffViewer, {
        componentName,
        renderStatus: score.renderStatus,
        renderFidelity: score.renderFidelity,
      }),
    ),
    // Harness Preview
    React.createElement(
      'div',
      { className: 'pp-section' },
      React.createElement(
        'h3',
        { className: 'pp-section-title' },
        'Live Preview',
      ),
      React.createElement(HarnessIframe, {
        file,
        exportName,
        port,
      }),
    ),
  );
}
