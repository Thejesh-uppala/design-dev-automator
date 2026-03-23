import React, { useState, useEffect } from 'react';
import { TokenTable, type TokenEntry } from '../components/TokenTable.js';

export function TokenReference() {
  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [source, setSource] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tokens')
      .then((r) => r.json())
      .then((data) => {
        setSource(data.source || null);
        setSyncedAt(data.syncedAt || null);

        // Convert token map to flat list
        const entries: TokenEntry[] = [];
        const rawTokens = data.tokens || {};
        for (const [path, value] of Object.entries(rawTokens)) {
          const v = value as Record<string, unknown>;
          entries.push({
            path,
            cssVar: `--${path.replace(/\//g, '-')}`,
            resolvedValue: String(v.resolvedValue ?? ''),
            type: String(v.type ?? 'unknown'),
          });
        }
        setTokens(entries);
      })
      .catch(() => {});
  }, []);

  const types = ['all', ...new Set(tokens.map((t) => t.type))];
  const filteredCount = tokens.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.path.toLowerCase().includes(q) ||
        t.cssVar.toLowerCase().includes(q) ||
        t.resolvedValue.toLowerCase().includes(q)
      );
    }
    return true;
  }).length;

  return React.createElement(
    'div',
    null,
    React.createElement(
      'h2',
      { className: 'pp-section-title' },
      'Token Reference',
    ),
    source &&
      React.createElement(
        'div',
        { style: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 } },
        `Source: ${source}${syncedAt ? ` · Synced: ${new Date(syncedAt).toLocaleString()}` : ''}`,
      ),
    React.createElement(
      'div',
      {
        className: 'pp-flex pp-items-center pp-gap-8',
        style: { marginBottom: 16 },
      },
      React.createElement('input', {
        className: 'pp-input',
        placeholder: 'Search tokens...',
        value: search,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          setSearch(e.target.value),
        style: { flex: 1 },
      }),
      React.createElement(
        'select',
        {
          className: 'pp-select',
          value: typeFilter,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            setTypeFilter(e.target.value),
        },
        ...types.map((t) =>
          React.createElement(
            'option',
            { key: t, value: t },
            t === 'all' ? 'All Types' : t,
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      { style: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 } },
      `Showing ${filteredCount} of ${tokens.length} tokens`,
    ),
    React.createElement(TokenTable, {
      tokens,
      searchQuery: search,
      typeFilter,
    }),
  );
}
