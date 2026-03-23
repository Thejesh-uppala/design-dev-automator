// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ViolationList } from '../components/ViolationList.js';
import type { Violation } from '../../scoring/types.js';

const mockViolation: Violation = {
  id: 'v1',
  file: 'src/Button.tsx',
  line: 10,
  column: 5,
  prop: 'color',
  found: '#ff0000',
  type: 'color',
  nearestToken: 'colors/primary',
  figmaToken: '--color-primary',
  resolvedValue: '#6366f1',
  source: 'jsx-style',
  confidence: 'exact',
};

describe('ViolationList', () => {
  it('shows no violations message when empty', () => {
    const { getByText } = render(
      React.createElement(ViolationList, { violations: [] }),
    );
    expect(getByText('No violations found.')).toBeTruthy();
  });

  it('displays violation location', () => {
    const { getByText } = render(
      React.createElement(ViolationList, {
        violations: [mockViolation],
      }),
    );
    expect(getByText('src/Button.tsx:10:5')).toBeTruthy();
  });

  it('displays prop and found value', () => {
    const { getAllByText } = render(
      React.createElement(ViolationList, {
        violations: [mockViolation],
      }),
    );
    expect(getAllByText('color: "#ff0000"').length).toBeGreaterThanOrEqual(1);
  });

  it('displays fix suggestion', () => {
    const { getAllByText } = render(
      React.createElement(ViolationList, {
        violations: [mockViolation],
      }),
    );
    expect(
      getAllByText('Replace with var(--color-primary)').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('displays confidence badge', () => {
    const { getAllByText } = render(
      React.createElement(ViolationList, {
        violations: [mockViolation],
      }),
    );
    expect(getAllByText('exact').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onClickViolation with line number', () => {
    const onClick = vi.fn();
    const { container } = render(
      React.createElement(ViolationList, {
        violations: [mockViolation],
        onClickViolation: onClick,
      }),
    );
    fireEvent.click(container.querySelector('.pp-violation')!);
    expect(onClick).toHaveBeenCalledWith(10);
  });
});
