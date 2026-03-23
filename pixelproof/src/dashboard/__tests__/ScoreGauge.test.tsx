// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { ScoreGauge } from '../components/ScoreGauge.js';

describe('ScoreGauge', () => {
  it('renders percentage text for numeric value', () => {
    const { container } = render(
      React.createElement(ScoreGauge, { value: 85, label: 'TC' }),
    );
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('85%');
  });

  it('renders -- for null value', () => {
    const { container } = render(
      React.createElement(ScoreGauge, { value: null, label: 'RF' }),
    );
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('--');
  });

  it('renders label', () => {
    const { getByText } = render(
      React.createElement(ScoreGauge, { value: 90, label: 'Token Compliance' }),
    );
    expect(getByText('Token Compliance')).toBeTruthy();
  });

  it('uses green color for value >= 80', () => {
    const { container } = render(
      React.createElement(ScoreGauge, { value: 95, label: 'TC' }),
    );
    const circles = container.querySelectorAll('circle');
    const arc = circles[1];
    expect(arc?.getAttribute('stroke')).toBe('var(--green)');
  });

  it('uses yellow color for value 50-79', () => {
    const { container } = render(
      React.createElement(ScoreGauge, { value: 65, label: 'TC' }),
    );
    const circles = container.querySelectorAll('circle');
    const arc = circles[1];
    expect(arc?.getAttribute('stroke')).toBe('var(--yellow)');
  });

  it('uses red color for value < 50', () => {
    const { container } = render(
      React.createElement(ScoreGauge, { value: 30, label: 'TC' }),
    );
    const circles = container.querySelectorAll('circle');
    const arc = circles[1];
    expect(arc?.getAttribute('stroke')).toBe('var(--red)');
  });
});
