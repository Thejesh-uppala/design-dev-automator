import React from 'react';
import type { ComponentScore } from '../../scoring/types.js';

interface ComponentCardProps {
  score: ComponentScore;
  onClick: () => void;
}

function scoreBadge(
  value: number | null,
  label: string,
): React.ReactElement | null {
  if (value === null) return null;
  const cls =
    value >= 80
      ? 'pp-badge--green'
      : value >= 50
        ? 'pp-badge--yellow'
        : 'pp-badge--red';
  return React.createElement(
    'span',
    { className: `pp-badge ${cls}` },
    `${label} ${value}%`,
  );
}

function deriveComponentName(file: string): string {
  const base = file.split('/').pop() || file;
  return base.replace(/\.(tsx?|jsx?)$/, '');
}

export function ComponentCard({ score, onClick }: ComponentCardProps) {
  const name = deriveComponentName(score.file);
  const borderColor =
    score.violations.length > 0
      ? 'var(--red)'
      : score.renderStatus === 'error'
        ? 'var(--orange)'
        : 'var(--green)';

  return React.createElement(
    'div',
    {
      className: 'pp-comp-card',
      onClick,
      style: { borderLeft: `3px solid ${borderColor}` },
    },
    React.createElement(
      'div',
      { style: { flex: 1 } },
      React.createElement(
        'div',
        { className: 'pp-comp-card-name' },
        name,
      ),
      React.createElement(
        'div',
        { className: 'pp-comp-card-file' },
        score.file,
      ),
    ),
    React.createElement(
      'div',
      { className: 'pp-flex pp-gap-8 pp-items-center' },
      scoreBadge(score.tokenCompliance, 'TC'),
      scoreBadge(score.renderFidelity, 'RF'),
      score.violations.length > 0 &&
        React.createElement(
          'span',
          { className: 'pp-badge pp-badge--red' },
          `${score.violations.length} violations`,
        ),
      score.renderStatus === 'skipped' &&
        React.createElement(
          'span',
          { className: 'pp-badge pp-badge--muted' },
          'Skipped',
        ),
      score.renderStatus === 'error' &&
        React.createElement(
          'span',
          { className: 'pp-badge pp-badge--red' },
          'Error',
        ),
    ),
  );
}
