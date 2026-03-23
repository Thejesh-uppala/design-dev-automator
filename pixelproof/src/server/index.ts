/**
 * Launches the full PixelProof dev server:
 * - Vite dev server with harness + dashboard plugins
 * - API middleware for source/tokens/screenshots
 * - WebSocket server for live score updates
 * - Render pipeline (if Chromium installed)
 */

import { createServer as createViteServer } from 'vite';
import { resolve } from 'node:path';
import type { Server as HttpServer } from 'node:http';
import type { PixelProofConfig } from '../config/schema.js';
import type { ScoreStore } from '../scoring/store.js';
import type { TokenMap } from '../tokens/types.js';
import { pixelproofPlugin } from '../render/vite-plugin.js';
import { createApiMiddleware } from '../render/api-middleware.js';
import { ScoreWebSocketServer } from '../ipc/ws-server.js';
import { detectProviders } from '../render/provider-detector.js';
import { renderPipeline } from '../render/pipeline.js';

export interface ServerOptions {
  rootDir: string;
  config: PixelProofConfig;
  scoreStore: ScoreStore;
  tokenMap: TokenMap;
}

export async function startServer(options: ServerOptions) {
  const { rootDir, config, scoreStore, tokenMap } = options;
  const port = config.dashboard.port;
  const pixelproofDir = resolve(rootDir, '.pixelproof');

  // Detect providers
  const providers = detectProviders(rootDir);

  // Create Vite dev server
  // We rely on the user's vite.config (auto-discovered from rootDir) for
  // framework plugins like @vitejs/plugin-react. We only add our own plugin.
  const vite = await createViteServer({
    root: rootDir,
    server: {
      port,
      strictPort: true,
      open: false,
    },
    plugins: [
      pixelproofPlugin({ config, providers }),
    ],
    optimizeDeps: {
      exclude: ['virtual:pixelproof-harness'],
    },
    logLevel: 'warn',
  });

  // Mount API middleware before Vite's own middleware
  vite.middlewares.use(createApiMiddleware({ rootDir, pixelproofDir }));

  // Start listening
  await vite.listen();

  const httpServer = vite.httpServer as HttpServer | null;
  if (!httpServer) {
    throw new Error('Vite HTTP server not available');
  }

  // Attach WebSocket server
  const wsServer = new ScoreWebSocketServer({
    server: httpServer,
    scoreStore,
  });

  console.log(`\n  PixelProof dashboard: http://localhost:${port}/`);
  console.log(`  Component harness:    http://localhost:${port}/harness`);

  // Run initial render pipeline if enabled
  if (config.render.enabled) {
    renderPipeline(config, scoreStore, rootDir, port).catch((err) => {
      console.warn(`Render pipeline: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  return {
    vite,
    wsServer,
    async close() {
      wsServer.close();
      await vite.close();
    },
  };
}
