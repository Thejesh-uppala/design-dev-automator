import React, { useState, useMemo } from 'react';
import { ColorSwatch } from './ColorSwatch.js';

export interface TokenEntry {
  path: string;
  cssVar: string;
  resolvedValue: string;
  type: string;
}

interface TokenTableProps {
  tokens: TokenEntry[];
  searchQuery: string;
  typeFilter: string;
}

type SortCol = 'path' | 'cssVar' | 'resolvedValue' | 'type';

export function TokenTable({
  tokens,
  searchQuery,
  typeFilter,
}: TokenTableProps) {
  const [sortCol, setSortCol] = useState<SortCol>('path');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = useMemo(() => {
    let list = [...tokens];

    if (typeFilter && typeFilter !== 'all') {
      list = list.filter((t) => t.type === typeFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.path.toLowerCase().includes(q) ||
          t.cssVar.toLowerCase().includes(q) ||
          t.resolvedValue.toLowerCase().includes(q),
      );
    }

    list.sort((a, b) => {
      const cmp = (a[sortCol] || '').localeCompare(b[sortCol] || '');
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [tokens, searchQuery, typeFilter, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const arrow = (col: SortCol) =>
    sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return React.createElement(
    'table',
    { className: 'pp-token-table' },
    React.createElement(
      'thead',
      null,
      React.createElement(
        'tr',
        null,
        React.createElement(
          'th',
          { onClick: () => handleSort('path') },
          `Token Path${arrow('path')}`,
        ),
        React.createElement(
          'th',
          { onClick: () => handleSort('cssVar') },
          `CSS Variable${arrow('cssVar')}`,
        ),
        React.createElement(
          'th',
          { onClick: () => handleSort('resolvedValue') },
          `Resolved Value${arrow('resolvedValue')}`,
        ),
        React.createElement(
          'th',
          { onClick: () => handleSort('type') },
          `Type${arrow('type')}`,
        ),
      ),
    ),
    React.createElement(
      'tbody',
      null,
      ...filtered.map((t) =>
        React.createElement(
          'tr',
          { key: t.path },
          React.createElement('td', null, t.path),
          React.createElement('td', null, `var(${t.cssVar})`),
          React.createElement(
            'td',
            null,
            t.type === 'color' &&
              React.createElement(ColorSwatch, { color: t.resolvedValue }),
            t.resolvedValue,
          ),
          React.createElement('td', null, t.type),
        ),
      ),
      filtered.length === 0 &&
        React.createElement(
          'tr',
          null,
          React.createElement(
            'td',
            {
              colSpan: 4,
              style: { textAlign: 'center', color: 'var(--text-muted)' },
            },
            'No tokens match',
          ),
        ),
    ),
  );
}
