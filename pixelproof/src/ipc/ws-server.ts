/**
 * WebSocket server for real-time score updates.
 *
 * Attaches to the Vite dev server's HTTP server on path /ws.
 * Broadcasts ScoreStore mutations to all connected dashboard clients.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { ScoreStore } from '../scoring/store.js';

export interface WsServerOptions {
  server: HttpServer;
  scoreStore: ScoreStore;
  renderCallback?: (file: string, exportName: string) => Promise<void>;
}

export class ScoreWebSocketServer {
  private wss: WebSocketServer;
  private unsubscribe: (() => void) | null = null;
  private upgradeHandler: ((req: import('node:http').IncomingMessage, socket: import('node:stream').Duplex, head: Buffer) => void) | null = null;

  constructor(private options: WsServerOptions) {
    // Use noServer mode to avoid conflicting with Vite's HMR WebSocket
    this.wss = new WebSocketServer({ noServer: true });

    // Manually handle upgrade requests only for our path
    this.upgradeHandler = (req, socket, head) => {
      const url = new URL(req.url || '', 'http://localhost');
      if (url.pathname === '/__pixelproof_ws') {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req);
        });
      }
      // Don't call socket.destroy() — let other handlers (Vite HMR) process it
    };
    options.server.on('upgrade', this.upgradeHandler);

    this.wss.on('connection', (ws) => {
      // Send initial state
      const components = options.scoreStore.getAllComponents();
      const aggregate = options.scoreStore.getAggregateScore();
      this.send(ws, {
        type: 'initial-state',
        data: { components, aggregate },
      });

      // Handle inbound messages
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw));
          if (msg.type === 'render-request' && msg.data) {
            this.handleRenderRequest(
              ws,
              msg.data.component,
              msg.data.export,
            );
          }
        } catch {
          // Silently drop invalid JSON
        }
      });
    });

    // Subscribe to store mutations
    this.unsubscribe = options.scoreStore.subscribe((event) => {
      const score = options.scoreStore.getComponentScore(event.file);
      const aggregate = options.scoreStore.getAggregateScore();

      if (score) {
        this.broadcast({ type: 'score-update', data: score });
      }
      this.broadcast({ type: 'aggregate-update', data: aggregate });
    });
  }

  private async handleRenderRequest(
    ws: WebSocket,
    file: string,
    exportName: string,
  ): Promise<void> {
    if (!this.options.renderCallback) {
      this.send(ws, {
        type: 'render-error',
        data: { message: 'Render not available' },
      });
      return;
    }

    try {
      await this.options.renderCallback(file, exportName);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : String(error);
      this.send(ws, {
        type: 'render-error',
        data: { message: msg },
      });
    }
  }

  private send(ws: WebSocket, data: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private broadcast(data: unknown): void {
    const json = JSON.stringify(data);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    }
  }

  close(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.upgradeHandler) {
      this.options.server.removeListener('upgrade', this.upgradeHandler);
      this.upgradeHandler = null;
    }
    this.wss.close();
  }
}
