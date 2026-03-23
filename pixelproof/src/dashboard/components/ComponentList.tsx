import React, { useState, useMemo } from 'react';
import { useScore } from '../contexts/ScoreContext.js';
import { ComponentCard } from './ComponentCard.js';
import { navigate } from '../router.js';
import type { ComponentScore } from '../../scoring/types.js';

type SortField = 'name' | 'tokenCompliance' | 'renderFidelity' | 'violations';
type FilterMode = 'all' | 'hasViolations' | 'renderErrors' | 'passing';

export function ComponentList() {
  const { components } = useScore();
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = [...components];

    // Filter
    if (filter === 'hasViolations') {
      list = list.filter((c) => c.violations.length > 0);
    } else if (filter === 'renderErrors') {
      list = list.filter((c) => c.renderStatus === 'error');
    } else if (filter === 'passing') {
      list = list.filter(
        (c) => c.violations.length === 0 && c.renderStatus !== 'error',
      );
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.file.toLowerCase().includes(q) ||
          c.exports.some((e) => e.toLowerCase().includes(q)),
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = a.file.localeCompare(b.file);
      } else if (sortBy === 'tokenCompliance') {
        cmp = (a.tokenCompliance ?? 0) - (b.tokenCompliance ?? 0);
      } else if (sortBy === 'renderFidelity') {
        cmp = (a.renderFidelity ?? 0) - (b.renderFidelity ?? 0);
      } else if (sortBy === 'violations') {
        cmp = a.violations.length - b.violations.length;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [components, sortBy, sortDir, filter, search]);

  const handleClick = (score: ComponentScore) => {
    navigate(`component/${encodeURIComponent(score.file)}`);
  };

  return React.createElement(
    'div',
    null,
    React.createElement(
      'div',
      {
        className: 'pp-flex pp-items-center pp-gap-8',
        style: { marginBottom: 16 },
      },
      React.createElement('input', {
        className: 'pp-input',
        placeholder: 'Search components...',
        value: search,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          setSearch(e.target.value),
        style: { flex: 1 },
      }),
      React.createElement(
        'select',
        {
          className: 'pp-select',
          value: sortBy,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            setSortBy(e.target.value as SortField),
        },
        React.createElement('option', { value: 'name' }, 'Name'),
        React.createElement(
          'option',
          { value: 'tokenCompliance' },
          'Token Compliance',
        ),
        React.createElement(
          'option',
          { value: 'renderFidelity' },
          'Render Fidelity',
        ),
        React.createElement(
          'option',
          { value: 'violations' },
          'Violations',
        ),
      ),
      React.createElement(
        'button',
        {
          className: 'pp-btn',
          onClick: () => setSortDir(sortDir === 'asc' ? 'desc' : 'asc'),
        },
        sortDir === 'asc' ? '↑' : '↓',
      ),
    ),
    React.createElement(
      'div',
      {
        className: 'pp-flex pp-gap-8',
        style: { marginBottom: 16 },
      },
      ...(['all', 'hasViolations', 'renderErrors', 'passing'] as const).map(
        (f) =>
          React.createElement(
            'button',
            {
              key: f,
              className: `pp-btn${filter === f ? ' pp-btn--primary' : ''}`,
              onClick: () => setFilter(f),
            },
            f === 'all'
              ? 'All'
              : f === 'hasViolations'
                ? 'Has Violations'
                : f === 'renderErrors'
                  ? 'Render Errors'
                  : 'Passing',
          ),
      ),
    ),
    React.createElement(
      'div',
      { style: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 } },
      `Showing ${filtered.length} of ${components.length} components`,
    ),
    React.createElement(
      'div',
      { className: 'pp-flex', style: { flexDirection: 'column', gap: 8 } },
      ...filtered.map((c) =>
        React.createElement(ComponentCard, {
          key: c.file,
          score: c,
          onClick: () => handleClick(c),
        }),
      ),
    ),
  );
}
