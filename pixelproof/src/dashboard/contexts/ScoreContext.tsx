import React, { createContext, useContext, useMemo } from 'react';
import type { ComponentScore, AggregateScore } from '../../scoring/types.js';
import { useScoreUpdates } from '../hooks/useScoreUpdates.js';

export interface ScoreContextValue {
  components: ComponentScore[];
  aggregate: AggregateScore;
  connected: boolean;
  sendRenderRequest: (file: string, exportName: string) => void;
}

const defaultAggregate: AggregateScore = {
  tokenCompliance: 0,
  renderFidelity: 0,
  totalComponents: 0,
  renderedComponents: 0,
  skippedComponents: 0,
  totalViolations: 0,
};

const ScoreCtx = createContext<ScoreContextValue>({
  components: [],
  aggregate: defaultAggregate,
  connected: false,
  sendRenderRequest: () => {},
});

export function ScoreProvider({ children }: { children: React.ReactNode }) {
  const { components, aggregate, connected, sendRenderRequest } =
    useScoreUpdates();

  const value = useMemo(
    () => ({ components, aggregate, connected, sendRenderRequest }),
    [components, aggregate, connected, sendRenderRequest],
  );

  return React.createElement(ScoreCtx.Provider, { value }, children);
}

export function useScore(): ScoreContextValue {
  return useContext(ScoreCtx);
}
