import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { ScoreStore } from '../../scoring/store.js';
import { ScoreWebSocketServer } from '../ws-server.js';
import { WebSocket } from 'ws';

let httpServer: HttpServer;
let wsServer: ScoreWebSocketServer;
let port: number;

/**
 * Create a client that buffers all incoming messages.
 * This avoids race conditions with ws.once('message') missing messages
 * that arrive before the listener is registered.
 */
function createBufferedClient(url: string): {
  ws: WebSocket;
  messages: unknown[];
  waitForMessage: (filter?: (msg: unknown) => boolean) => Promise<unknown>;
  waitForOpen: () => Promise<void>;
} {
  const ws = new WebSocket(url);
  const messages: unknown[] = [];
  const waiters: Array<{
    filter: (msg: unknown) => boolean;
    resolve: (msg: unknown) => void;
  }> = [];

  ws.on('message', (data) => {
    const parsed = JSON.parse(String(data));
    // Check if any waiter wants this message
    const idx = waiters.findIndex((w) => w.filter(parsed));
    if (idx >= 0) {
      const waiter = waiters.splice(idx, 1)[0];
      waiter.resolve(parsed);
    } else {
      messages.push(parsed);
    }
  });

  return {
    ws,
    messages,
    waitForMessage(filter?: (msg: unknown) => boolean) {
      const matchFn = filter || (() => true);
      // Check buffer first
      const idx = messages.findIndex(matchFn);
      if (idx >= 0) {
        return Promise.resolve(messages.splice(idx, 1)[0]);
      }
      // Wait for next matching message
      return new Promise((resolve) => {
        waiters.push({ filter: matchFn, resolve });
      });
    },
    waitForOpen() {
      return new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN) {
          resolve();
        } else {
          ws.once('open', () => resolve());
        }
      });
    },
  };
}

function byType(type: string) {
  return (msg: unknown) =>
    typeof msg === 'object' && msg !== null && (msg as Record<string, unknown>).type === type;
}

beforeEach(async () => {
  httpServer = createServer();
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
  const addr = httpServer.address();
  port = typeof addr === 'object' && addr ? addr.port : 0;
});

afterEach(async () => {
  wsServer?.close();
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
});

describe('ScoreWebSocketServer', () => {
  it('sends initial-state on connection', async () => {
    const store = new ScoreStore();
    store.setViolations('src/Button.tsx', [], 10);

    wsServer = new ScoreWebSocketServer({
      server: httpServer,
      scoreStore: store,
    });

    const client = createBufferedClient(`ws://localhost:${port}/__pixelproof_ws`);
    const msg = (await client.waitForMessage(byType('initial-state'))) as Record<string, unknown>;

    expect(msg.type).toBe('initial-state');
    const data = msg.data as Record<string, unknown>;
    expect(Array.isArray(data.components)).toBe(true);
    expect((data.components as unknown[]).length).toBe(1);

    client.ws.close();
  });

  it('broadcasts score-update on store mutation', async () => {
    const store = new ScoreStore();
    store.setViolations('src/Button.tsx', [], 10);

    wsServer = new ScoreWebSocketServer({
      server: httpServer,
      scoreStore: store,
    });

    const client = createBufferedClient(`ws://localhost:${port}/__pixelproof_ws`);
    // Wait for initial-state first
    await client.waitForMessage(byType('initial-state'));

    // Mutate the store
    store.setViolations('src/Button.tsx', [], 8);

    const msg = (await client.waitForMessage(byType('score-update'))) as Record<string, unknown>;
    expect(msg.type).toBe('score-update');

    client.ws.close();
  });

  it('broadcasts aggregate-update on store mutation', async () => {
    const store = new ScoreStore();
    store.setViolations('src/Button.tsx', [], 10);

    wsServer = new ScoreWebSocketServer({
      server: httpServer,
      scoreStore: store,
    });

    const client = createBufferedClient(`ws://localhost:${port}/__pixelproof_ws`);
    await client.waitForMessage(byType('initial-state'));

    store.setRenderFidelity('src/Button.tsx', 90, 'rendered');

    const scoreMsg = (await client.waitForMessage(byType('score-update'))) as Record<string, unknown>;
    const aggMsg = (await client.waitForMessage(byType('aggregate-update'))) as Record<string, unknown>;

    expect(scoreMsg.type).toBe('score-update');
    expect(aggMsg.type).toBe('aggregate-update');

    client.ws.close();
  });

  it('handles render-request from client', async () => {
    const store = new ScoreStore();
    const renderCallback = vi.fn().mockResolvedValue(undefined);

    wsServer = new ScoreWebSocketServer({
      server: httpServer,
      scoreStore: store,
      renderCallback,
    });

    const client = createBufferedClient(`ws://localhost:${port}/__pixelproof_ws`);
    await client.waitForOpen();
    await client.waitForMessage(byType('initial-state'));

    client.ws.send(
      JSON.stringify({
        type: 'render-request',
        data: { component: 'src/Button.tsx', export: 'Button' },
      }),
    );

    // Wait a tick for the callback to be invoked
    await new Promise((r) => setTimeout(r, 50));
    expect(renderCallback).toHaveBeenCalledWith('src/Button.tsx', 'Button');

    client.ws.close();
  });

  it('responds with render-error when no callback', async () => {
    const store = new ScoreStore();

    wsServer = new ScoreWebSocketServer({
      server: httpServer,
      scoreStore: store,
    });

    const client = createBufferedClient(`ws://localhost:${port}/__pixelproof_ws`);
    await client.waitForOpen();
    await client.waitForMessage(byType('initial-state'));

    client.ws.send(
      JSON.stringify({
        type: 'render-request',
        data: { component: 'src/Button.tsx', export: 'Button' },
      }),
    );

    const msg = (await client.waitForMessage(byType('render-error'))) as Record<string, unknown>;
    expect(msg.type).toBe('render-error');

    client.ws.close();
  });

  it('silently drops invalid JSON', async () => {
    const store = new ScoreStore();

    wsServer = new ScoreWebSocketServer({
      server: httpServer,
      scoreStore: store,
    });

    const client = createBufferedClient(`ws://localhost:${port}/__pixelproof_ws`);
    await client.waitForOpen();
    await client.waitForMessage(byType('initial-state'));

    // Send invalid JSON — should not crash
    client.ws.send('not valid json');

    // Wait to confirm no crash
    await new Promise((r) => setTimeout(r, 50));
    expect(client.ws.readyState).toBe(WebSocket.OPEN);

    client.ws.close();
  });

  it('broadcasts to multiple clients', async () => {
    const store = new ScoreStore();
    store.setViolations('src/Button.tsx', [], 10);

    wsServer = new ScoreWebSocketServer({
      server: httpServer,
      scoreStore: store,
    });

    const client1 = createBufferedClient(`ws://localhost:${port}/__pixelproof_ws`);
    const client2 = createBufferedClient(`ws://localhost:${port}/__pixelproof_ws`);

    await client1.waitForMessage(byType('initial-state'));
    await client2.waitForMessage(byType('initial-state'));

    // Mutate store
    store.setViolations('src/Button.tsx', [], 5);

    const msg1 = (await client1.waitForMessage(byType('score-update'))) as Record<string, unknown>;
    const msg2 = (await client2.waitForMessage(byType('score-update'))) as Record<string, unknown>;

    expect(msg1.type).toBe('score-update');
    expect(msg2.type).toBe('score-update');

    client1.ws.close();
    client2.ws.close();
  });
});
