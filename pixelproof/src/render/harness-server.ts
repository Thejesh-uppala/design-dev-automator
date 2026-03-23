import { createServer, type ViteDevServer, type InlineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PixelProofConfig } from '../config/schema.js';
import { createApiMiddleware } from './api-middleware.js';
import { pixelproofPlugin, type PixelProofPluginOptions } from './vite-plugin.js';

export interface HarnessServer {
  server: ViteDevServer;
  close: () => Promise<void>;
}

/**
 * Build the Vite inline config for the harness server.
 * Exported for testing.
 */
export function buildHarnessConfig(
  config: PixelProofConfig,
  rootDir: string,
  plugins: unknown[] = [],
): InlineConfig {
  const port = config.dashboard.port;

  // Check for user's vite config
  const userConfigFile = [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mts',
    'vite.config.mjs',
  ]
    .map((f) => resolve(rootDir, f))
    .find((f) => existsSync(f));

  return {
    configFile: userConfigFile || false,
    root: rootDir,
    server: {
      port,
      strictPort: true,
      host: 'localhost',
    },
    plugins: userConfigFile ? plugins : plugins,
    logLevel: 'silent',
  };
}

/**
 * Start the PixelProof harness Vite dev server.
 */
export async function startHarnessServer(
  config: PixelProofConfig,
  rootDir: string,
  pluginOptions?: Partial<PixelProofPluginOptions>,
): Promise<HarnessServer> {
  const port = config.dashboard.port;

  // Build plugin options
  const fullPluginOptions: PixelProofPluginOptions = {
    config,
    providers: [],
    ...pluginOptions,
  };

  // Load React plugin + PixelProof plugin
  const plugins: unknown[] = [pixelproofPlugin(fullPluginOptions)];
  try {
    const reactPlugin = await import('@vitejs/plugin-react');
    const react =
      typeof reactPlugin.default === 'function'
        ? reactPlugin.default
        : reactPlugin;
    plugins.unshift(react());
  } catch {
    // @vitejs/plugin-react not available — user project may provide it
  }

  const inlineConfig = buildHarnessConfig(config, rootDir, plugins);

  try {
    const server = await createServer(inlineConfig);

    // Register API middleware before Vite's own middleware
    const pixelproofDir = resolve(rootDir, '.pixelproof');
    const apiMiddleware = createApiMiddleware({
      rootDir,
      pixelproofDir,
    });
    server.middlewares.use(apiMiddleware);

    await server.listen();

    console.log(`PixelProof harness running at http://localhost:${port}`);

    return {
      server,
      close: async () => {
        await server.close();
      },
    };
  } catch (error: unknown) {
    // Vite with strictPort throws when port is in use
    const isPortInUse =
      error instanceof Error &&
      (error.message.includes('EADDRINUSE') ||
        error.message.includes('is already in use') ||
        error.message.includes(`Port ${port}`));

    if (isPortInUse) {
      throw new Error(
        `Port ${port} is in use. Configure a different port in .pixelproofrc`,
      );
    }
    throw error;
  }
}
