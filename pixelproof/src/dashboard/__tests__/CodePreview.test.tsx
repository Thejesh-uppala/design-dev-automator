// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { CodePreview } from '../components/CodePreview.js';

describe('CodePreview', () => {
  it('renders source lines with line numbers', () => {
    const source = 'const a = 1;\nconst b = 2;';
    const { container } = render(
      React.createElement(CodePreview, {
        source,
        violations: [],
      }),
    );
    const lines = container.querySelectorAll('.pp-code-line');
    expect(lines.length).toBe(2);
    expect(lines[0].querySelector('.pp-code-gutter')?.textContent).toBe('1');
    expect(lines[1].querySelector('.pp-code-gutter')?.textContent).toBe('2');
  });

  it('highlights violation lines', () => {
    const source = 'line 1\nline 2\nline 3';
    const { container } = render(
      React.createElement(CodePreview, {
        source,
        violations: [
          {
            id: 'v1',
            file: 'test.tsx',
            line: 2,
            column: 1,
            prop: 'color',
            found: '#ff0000',
            type: 'color' as const,
            nearestToken: 't',
            figmaToken: '',
            resolvedValue: '',
            source: 'jsx-style' as const,
            confidence: 'exact' as const,
          },
        ],
      }),
    );
    const violationLines = container.querySelectorAll(
      '.pp-code-line--violation',
    );
    expect(violationLines.length).toBe(1);
    expect(violationLines[0].getAttribute('data-line')).toBe('2');
  });

  it('applies syntax highlighting to keywords', () => {
    const source = 'const x = 5;';
    const { container } = render(
      React.createElement(CodePreview, {
        source,
        violations: [],
      }),
    );
    const keyword = container.querySelector('.pp-syn-keyword');
    expect(keyword?.textContent).toBe('const');
  });

  it('applies syntax highlighting to strings', () => {
    const source = 'const x = "hello";';
    const { container } = render(
      React.createElement(CodePreview, {
        source,
        violations: [],
      }),
    );
    const str = container.querySelector('.pp-syn-string');
    expect(str?.textContent).toBe('"hello"');
  });
});
