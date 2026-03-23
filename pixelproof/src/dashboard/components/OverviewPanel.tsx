import React from 'react';
import { useScore } from '../contexts/ScoreContext.js';
import { ScoreGauge } from './ScoreGauge.js';
import { SyncStatus } from './SyncStatus.js';

export function OverviewPanel() {
  const { aggregate, connected } = useScore();

  const rfValue =
    aggregate.renderedComponents > 0 ? aggregate.renderFidelity : null;

  return React.createElement(
    'div',
    null,
    !connected &&
      React.createElement(
        'div',
        {
          className: 'pp-card',
          style: {
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'var(--red)',
            marginBottom: 16,
          },
        },
        'Disconnected from server. Reconnecting...',
      ),
    React.createElement(
      'div',
      { className: 'pp-section' },
      React.createElement(
        'h2',
        { className: 'pp-section-title' },
        'Design Score',
      ),
      React.createElement(
        'div',
        {
          className: 'pp-flex pp-gap-24',
          style: { justifyContent: 'center', padding: '24px 0' },
        },
        React.createElement(ScoreGauge, {
          value: aggregate.tokenCompliance,
          label: 'Token Compliance',
          size: 140,
        }),
        React.createElement(ScoreGauge, {
          value: rfValue,
          label: 'Render Fidelity',
          size: 140,
        }),
      ),
    ),
    React.createElement(
      'div',
      { className: 'pp-grid-2', style: { marginBottom: 24 } },
      React.createElement(
        'div',
        { className: 'pp-card' },
        React.createElement(
          'div',
          { style: { fontSize: 28, fontWeight: 700, color: 'var(--red)' } },
          String(aggregate.totalViolations),
        ),
        React.createElement(
          'div',
          { style: { fontSize: 12, color: 'var(--text-secondary)' } },
          'Total Violations',
        ),
      ),
      React.createElement(
        'div',
        { className: 'pp-card' },
        React.createElement(
          'div',
          { style: { fontSize: 28, fontWeight: 700 } },
          String(aggregate.totalComponents),
        ),
        React.createElement(
          'div',
          { style: { fontSize: 12, color: 'var(--text-secondary)' } },
          'Components Scanned',
        ),
      ),
    ),
    React.createElement(
      'div',
      { className: 'pp-card' },
      React.createElement(
        'div',
        {
          className: 'pp-flex pp-items-center pp-gap-12',
          style: { fontSize: 13 },
        },
        React.createElement(
          'span',
          null,
          `${aggregate.renderedComponents} rendered`,
        ),
        React.createElement(
          'span',
          { style: { color: 'var(--text-muted)' } },
          '|',
        ),
        React.createElement(
          'span',
          null,
          `${aggregate.skippedComponents} skipped`,
        ),
      ),
    ),
    React.createElement(
      'div',
      { style: { marginTop: 16 } },
      React.createElement(SyncStatus, null),
    ),
  );
}
