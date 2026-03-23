// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { DiffViewer } from '../components/DiffViewer.js';

describe('DiffViewer', () => {
  it('shows skipped message when renderStatus is skipped', () => {
    const { getByText } = render(
      React.createElement(DiffViewer, {
        componentName: 'Button',
        renderStatus: 'skipped',
        renderFidelity: null,
      }),
    );
    expect(getByText(/Render skipped/)).toBeTruthy();
  });

  it('shows error message when renderStatus is error', () => {
    const { getByText } = render(
      React.createElement(DiffViewer, {
        componentName: 'Button',
        renderStatus: 'error',
        renderFidelity: null,
      }),
    );
    expect(getByText(/Render error/)).toBeTruthy();
  });

  it('shows waiting message when renderStatus is pending', () => {
    const { getByText } = render(
      React.createElement(DiffViewer, {
        componentName: 'Button',
        renderStatus: 'pending',
        renderFidelity: null,
      }),
    );
    expect(getByText(/Waiting for render/)).toBeTruthy();
  });

  it('shows images and fidelity score when rendered', () => {
    const { getByText, container } = render(
      React.createElement(DiffViewer, {
        componentName: 'Button',
        renderStatus: 'rendered',
        renderFidelity: 91.2,
      }),
    );
    expect(getByText('Render Fidelity: 91.2%')).toBeTruthy();
    const images = container.querySelectorAll('img');
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it('toggles diff overlay', () => {
    const { getAllByText, container } = render(
      React.createElement(DiffViewer, {
        componentName: 'Button',
        renderStatus: 'rendered',
        renderFidelity: 90,
      }),
    );
    const btns = getAllByText('Show Diff Overlay');
    fireEvent.click(btns[btns.length - 1]);
    expect(getAllByText('Hide Diff Overlay').length).toBeGreaterThanOrEqual(1);
  });
});
