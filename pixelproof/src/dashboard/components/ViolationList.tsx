import React from 'react';
import type { Violation } from '../../scoring/types.js';

interface ViolationListProps {
  violations: Violation[];
  onClickViolation?: (line: number) => void;
}

export function ViolationList({
  violations,
  onClickViolation,
}: ViolationListProps) {
  if (violations.length === 0) {
    return React.createElement(
      'div',
      { style: { color: 'var(--text-muted)', padding: 16 } },
      'No violations found.',
    );
  }

  return React.createElement(
    'div',
    null,
    ...violations.map((v) =>
      React.createElement(
        'div',
        {
          key: v.id,
          className: 'pp-violation',
          onClick: () => onClickViolation?.(v.line),
        },
        React.createElement(
          'div',
          { className: 'pp-violation-loc' },
          `${v.file}:${v.line}:${v.column}`,
        ),
        React.createElement(
          'div',
          { className: 'pp-violation-prop' },
          `${v.prop}: "${v.found}"`,
        ),
        v.nearestToken &&
          React.createElement(
            'div',
            { className: 'pp-violation-fix' },
            `Replace with var(${v.figmaToken || '--' + v.nearestToken.replace(/\//g, '-')})`,
          ),
        React.createElement(
          'span',
          {
            className: `pp-badge ${v.confidence === 'exact' ? 'pp-badge--green' : 'pp-badge--yellow'}`,
            style: { marginTop: 4 },
          },
          v.confidence,
        ),
      ),
    ),
  );
}
