// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { RenderButton } from '../components/RenderButton.js';

describe('RenderButton', () => {
  it('shows "Render" for pending status', () => {
    const onRender = vi.fn();
    const { getByText } = render(
      React.createElement(RenderButton, {
        file: 'src/Button.tsx',
        exportName: 'Button',
        renderStatus: 'pending',
        isRendering: false,
        onRender,
      }),
    );
    expect(getByText('Render')).toBeTruthy();
  });

  it('shows "Re-render" for rendered status', () => {
    const onRender = vi.fn();
    const { getByText } = render(
      React.createElement(RenderButton, {
        file: 'src/Button.tsx',
        exportName: 'Button',
        renderStatus: 'rendered',
        isRendering: false,
        onRender,
      }),
    );
    expect(getByText('Re-render')).toBeTruthy();
  });

  it('shows "Rendering..." when isRendering', () => {
    const onRender = vi.fn();
    const { getByText } = render(
      React.createElement(RenderButton, {
        file: 'src/Button.tsx',
        exportName: 'Button',
        renderStatus: 'pending',
        isRendering: true,
        onRender,
      }),
    );
    expect(getByText('Rendering...')).toBeTruthy();
  });

  it('is disabled when rendering', () => {
    const onRender = vi.fn();
    const { container } = render(
      React.createElement(RenderButton, {
        file: 'src/Button.tsx',
        exportName: 'Button',
        renderStatus: 'pending',
        isRendering: true,
        onRender,
      }),
    );
    const btn = container.querySelector('button');
    expect(btn?.disabled).toBe(true);
  });

  it('calls onRender with file and exportName', () => {
    const onRender = vi.fn();
    const { container } = render(
      React.createElement(RenderButton, {
        file: 'src/Button.tsx',
        exportName: 'Button',
        renderStatus: 'pending',
        isRendering: false,
        onRender,
      }),
    );
    fireEvent.click(container.querySelector('button')!);
    expect(onRender).toHaveBeenCalledWith('src/Button.tsx', 'Button');
  });
});
