import { useState, useEffect, useRef, useCallback } from 'react';
import type { ComponentScore, AggregateScore } from '../../scoring/types.js';

const RECONNECT_DELAY = 1000;

const defaultAggregate: AggregateScore = {
  tokenCompliance: 0,
  renderFidelity: 0,
  totalComponents: 0,
  renderedComponents: 0,
  skippedComponents: 0,
  totalViolations: 0,
};

export interface ScoreUpdatesResult {
  components: ComponentScore[];
  aggregate: AggregateScore;
  connected: boolean;
  sendRenderRequest: (file: string, exportName: string) => void;
}

export function useScoreUpdates(): ScoreUpdatesResult {
  const [components, setComponents] = useState<ComponentScore[]>([]);
  const [aggregate, setAggregate] = useState<AggregateScore>(defaultAggregate);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const port = window.location.port || '3001';
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'initial-state') {
          setComponents(msg.data.components);
          setAggregate(msg.data.aggregate);
        } else if (msg.type === 'score-update') {
          setComponents((prev) => {
            const idx = prev.findIndex(
              (c) => c.file === msg.data.file,
            );
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = msg.data;
              return updated;
            }
            return [...prev, msg.data];
          });
        } else if (msg.type === 'aggregate-update') {
          setAggregate(msg.data);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendRenderRequest = useCallback(
    (file: string, exportName: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'render-request',
            data: { component: file, export: exportName },
          }),
        );
      }
    },
    [],
  );

  return { components, aggregate, connected, sendRenderRequest };
}
