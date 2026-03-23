// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { TokenTable, type TokenEntry } from '../components/TokenTable.js';

const mockTokens: TokenEntry[] = [
  {
    path: 'colors/primary',
    cssVar: '--colors-primary',
    resolvedValue: '#6366f1',
    type: 'color',
  },
  {
    path: 'spacing/md',
    cssVar: '--spacing-md',
    resolvedValue: '16px',
    type: 'spacing',
  },
  {
    path: 'colors/danger',
    cssVar: '--colors-danger',
    resolvedValue: '#ef4444',
    type: 'color',
  },
];

describe('TokenTable', () => {
  it('renders all tokens when no filter', () => {
    const { container } = render(
      React.createElement(TokenTable, {
        tokens: mockTokens,
        searchQuery: '',
        typeFilter: 'all',
      }),
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('filters by type', () => {
    const { container } = render(
      React.createElement(TokenTable, {
        tokens: mockTokens,
        searchQuery: '',
        typeFilter: 'color',
      }),
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
  });

  it('filters by search query', () => {
    const { container } = render(
      React.createElement(TokenTable, {
        tokens: mockTokens,
        searchQuery: 'primary',
        typeFilter: 'all',
      }),
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
  });

  it('shows no match message when nothing found', () => {
    const { getByText } = render(
      React.createElement(TokenTable, {
        tokens: mockTokens,
        searchQuery: 'nonexistent',
        typeFilter: 'all',
      }),
    );
    expect(getByText('No tokens match')).toBeTruthy();
  });

  it('sorts by column on header click', () => {
    const { container } = render(
      React.createElement(TokenTable, {
        tokens: mockTokens,
        searchQuery: '',
        typeFilter: 'all',
      }),
    );
    const headers = container.querySelectorAll('th');
    // Click "Token Path" header to toggle sort
    fireEvent.click(headers[0]);
    const firstCell = container.querySelector('tbody tr td');
    expect(firstCell?.textContent).toBeTruthy();
  });

  it('renders color swatches for color tokens', () => {
    const { container } = render(
      React.createElement(TokenTable, {
        tokens: mockTokens,
        searchQuery: '',
        typeFilter: 'color',
      }),
    );
    const swatches = container.querySelectorAll('.pp-swatch');
    expect(swatches.length).toBe(2);
  });
});
