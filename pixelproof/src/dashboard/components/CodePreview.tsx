import React, { useRef, useEffect } from 'react';
import type { Violation } from '../../scoring/types.js';

interface CodePreviewProps {
  source: string;
  violations: Violation[];
  scrollToLine?: number;
}

function highlightLine(line: string): React.ReactElement[] {
  const parts: React.ReactElement[] = [];
  let remaining = line;
  let key = 0;

  const patterns: Array<{ regex: RegExp; cls: string }> = [
    { regex: /^(\/\/.*)/, cls: 'pp-syn-comment' },
    {
      regex:
        /^(import|export|from|const|let|var|function|return|if|else|class|extends|new|typeof|async|await|default)\b/,
      cls: 'pp-syn-keyword',
    },
    { regex: /^("[^"]*"|'[^']*'|`[^`]*`)/, cls: 'pp-syn-string' },
    { regex: /^(<\/?[A-Za-z][A-Za-z0-9.]*|\/?>)/, cls: 'pp-syn-tag' },
    { regex: /^(\d+\.?\d*)/, cls: 'pp-syn-number' },
  ];

  while (remaining.length > 0) {
    let matched = false;
    for (const { regex, cls } of patterns) {
      const m = remaining.match(regex);
      if (m) {
        parts.push(
          React.createElement('span', { key: key++, className: cls }, m[0]),
        );
        remaining = remaining.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Take one character as plain text
      const nextSpecial = remaining.slice(1).search(/[/"'`<\d]/);
      const end = nextSpecial === -1 ? remaining.length : nextSpecial + 1;
      parts.push(React.createElement('span', { key: key++ }, remaining.slice(0, end)));
      remaining = remaining.slice(end);
    }
  }

  return parts;
}

export function CodePreview({
  source,
  violations,
  scrollToLine,
}: CodePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const violationLines = new Set(violations.map((v) => v.line));
  const lines = source.split('\n');

  useEffect(() => {
    if (scrollToLine && containerRef.current) {
      const lineEl = containerRef.current.querySelector(
        `[data-line="${scrollToLine}"]`,
      );
      lineEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [scrollToLine]);

  return React.createElement(
    'div',
    { className: 'pp-code', ref: containerRef },
    ...lines.map((line, i) => {
      const lineNum = i + 1;
      const isViolation = violationLines.has(lineNum);
      return React.createElement(
        'div',
        {
          key: lineNum,
          className: `pp-code-line${isViolation ? ' pp-code-line--violation' : ''}`,
          'data-line': lineNum,
        },
        React.createElement(
          'span',
          { className: 'pp-code-gutter' },
          String(lineNum),
        ),
        React.createElement(
          'span',
          { className: 'pp-code-content' },
          ...highlightLine(line),
        ),
      );
    }),
  );
}
