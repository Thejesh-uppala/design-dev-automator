import React, { useState, useEffect } from 'react';

interface TokenMeta {
  syncedAt: string | null;
  source: string | null;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    'figma-mcp': 'Figma MCP',
    'figma-rest': 'Figma REST API',
    local: 'Local files',
    none: 'No source',
  };
  return labels[source] || source;
}

export function SyncStatus() {
  const [meta, setMeta] = useState<TokenMeta | null>(null);

  useEffect(() => {
    fetch('/api/tokens')
      .then((r) => r.json())
      .then((data) =>
        setMeta({
          syncedAt: data.syncedAt || null,
          source: data.source || null,
        }),
      )
      .catch(() => {});
  }, []);

  if (!meta) return null;
  if (!meta.syncedAt) {
    return React.createElement(
      'div',
      { style: { fontSize: 12, color: 'var(--text-muted)' } },
      'No tokens synced yet',
    );
  }

  return React.createElement(
    'div',
    { style: { fontSize: 12, color: 'var(--text-secondary)' } },
    `Tokens synced ${relativeTime(meta.syncedAt)} from ${sourceLabel(meta.source || 'none')}`,
  );
}
