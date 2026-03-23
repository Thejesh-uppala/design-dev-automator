/**
 * Lightweight hash router for the PixelProof dashboard.
 * No external dependencies — three routes, one parameterized.
 */

import { useState, useEffect } from 'react';

export interface RouteMatch {
  route: string;
  params: Record<string, string>;
}

/**
 * Parse the current hash into a route match.
 */
export function parseHash(hash: string): RouteMatch {
  const path = hash.replace(/^#\/?/, '');

  if (!path || path === '/') {
    return { route: 'overview', params: {} };
  }

  if (path === 'tokens') {
    return { route: 'tokens', params: {} };
  }

  const compMatch = path.match(/^component\/(.+)$/);
  if (compMatch) {
    return {
      route: 'component',
      params: { file: decodeURIComponent(compMatch[1]) },
    };
  }

  return { route: 'overview', params: {} };
}

/**
 * React hook that tracks the current hash route.
 */
export function useRoute(): RouteMatch {
  const [match, setMatch] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => setMatch(parseHash(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return match;
}

/**
 * Navigate to a hash route.
 */
export function navigate(path: string): void {
  window.location.hash = path;
}
