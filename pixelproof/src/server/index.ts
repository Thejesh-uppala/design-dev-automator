/**
 * Launches the full PixelProof dev server:
 * - Vite dev server with harness + dashboard plugins
 * - API middleware for source/tokens/screenshots
 * - WebSocket server for live score updates
 * - Render pipeline (if Chromium installed)
 */

import { createServer as createViteServer } from 'vite';
import type { Server as HttpServer } from 'node:http';
import type { PixelProofConfig } from '../config/schema.js';
import type { ScoreStore } from '../scoring/store.js';
import type { TokenMap } from '../tokens/types.js';
import { pixelproofPlugin } from '../render/vite-plugin.js';
import { ScoreWebSocketServer } from '../ipc/ws-server.js';
import { detectProviders } from '../render/provider-detector.js';
import { renderPipeline, renderSingleComponent } from '../render/pipeline.js';
import { isChromiumInstalled } from '../render/playwright-setup.js';
import { PlaywrightRunner } from '../render/playwright-runner.js';

export interface ServerOptions {
  rootDir: string;
  config: PixelProofConfig;
  scoreStore: ScoreStore;
  tokenMap: TokenMap;
}

export async function startServer(options: ServerOptions) {
  const { rootDir, config, scoreStore, tokenMap } = options;
  const port = config.dashboard.port;

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
      pixelproofPlugin({ config, providers, rootDir }),
    ],
    optimizeDeps: {
      exclude: ['virtual:pixelproof-harness'],
    },
    logLevel: 'warn',
  });

  // Start listening
  await vite.listen();

  const httpServer = vite.httpServer as HttpServer | null;
  if (!httpServer) {
    throw new Error('Vite HTTP server not available');
  }

  // Create a render callback for on-demand re-rendering from the dashboard
  let runner: PlaywrightRunner | null = null;
  const baselines = new Map<string, string>();

  const renderCallback = async (file: string, _exportName: string): Promise<void> => {
    if (!(await isChromiumInstalled())) {
      throw new Error('Chromium not installed. Run: npx pixelproof install');
    }

    if (!runner) {
      runner = new PlaywrightRunner();
      await runner.launch();
    }

    await renderSingleComponent(
      file,
      config,
      scoreStore,
      runner,
      rootDir,
      port,
      baselines,
    );
  };

  // Attach WebSocket server with render callback
  const wsServer = new ScoreWebSocketServer({
    server: httpServer,
    scoreStore,
    renderCallback,
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
      if (runner) {
        await runner.close();
        runner = null;
      }
      wsServer.close();
      await vite.close();
    },
  };
}
