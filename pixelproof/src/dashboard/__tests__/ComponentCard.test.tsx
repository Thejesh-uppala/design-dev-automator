// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ComponentCard } from '../components/ComponentCard.js';
import type { ComponentScore } from '../../scoring/types.js';

function makeScore(
  overrides: Partial<ComponentScore> = {},
): ComponentScore {
  return {
    file: 'src/components/Button.tsx',
    exports: ['Button'],
    tokenCompliance: 95.0,
    renderFidelity: 88.5,
    renderStatus: 'rendered',
    violations: [],
    ...overrides,
  };
}

describe('ComponentCard', () => {
  it('displays component name derived from file', () => {
    const onClick = vi.fn();
    const { getByText } = render(
      React.createElement(ComponentCard, {
        score: makeScore(),
        onClick,
      }),
    );
    expect(getByText('Button')).toBeTruthy();
  });

  it('displays file path', () => {
    const onClick = vi.fn();
    const { getAllByText } = render(
      React.createElement(ComponentCard, {
        score: makeScore(),
        onClick,
      }),
    );
    expect(getAllByText('src/components/Button.tsx').length).toBeGreaterThanOrEqual(1);
  });

  it('displays TC and RF badges', () => {
    const onClick = vi.fn();
    const { getAllByText } = render(
      React.createElement(ComponentCard, {
        score: makeScore(),
        onClick,
      }),
    );
    expect(getAllByText('TC 95%').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('RF 88.5%').length).toBeGreaterThanOrEqual(1);
  });

  it('shows violation count badge', () => {
    const onClick = vi.fn();
    const { getByText } = render(
      React.createElement(ComponentCard, {
        score: makeScore({
          violations: [
            {
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
            },
          ],
        }),
        onClick,
      }),
    );
    expect(getByText('1 violations')).toBeTruthy();
  });

  it('shows skipped badge', () => {
    const onClick = vi.fn();
    const { getByText } = render(
      React.createElement(ComponentCard, {
        score: makeScore({ renderStatus: 'skipped', renderFidelity: null }),
        onClick,
      }),
    );
    expect(getByText('Skipped')).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { container } = render(
      React.createElement(ComponentCard, {
        score: makeScore(),
        onClick,
      }),
    );
    fireEvent.click(container.querySelector('.pp-comp-card')!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
