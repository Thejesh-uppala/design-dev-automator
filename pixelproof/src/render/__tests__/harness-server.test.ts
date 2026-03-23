import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildHarnessConfig, startHarnessServer } from '../harness-server.js';
import type { PixelProofConfig } from '../../config/schema.js';
import { resolve } from 'node:path';

function makeConfig(overrides: Partial<PixelProofConfig> = {}): PixelProofConfig {
  return {
    scan: { include: ['src/**'], exclude: [], fileTypes: ['tsx', 'ts'] },
    tokens: { format: 'dtcg', fallbackDir: 'tokens/' },
    dashboard: { port: 3001, ...overrides.dashboard },
    render: {
      enabled: true,
      viewport: { width: 1440, height: 900 },
      tolerance: 4,
      theme: 'light',
      ...overrides.render,
    },
    ...overrides,
  };
}

describe('buildHarnessConfig', () => {
  it('sets port and strictPort from config', () => {
    const config = makeConfig({ dashboard: { port: 4000 } });
    const result = buildHarnessConfig(config, '/tmp/project');
    expect(result.server?.port).toBe(4000);
    expect(result.server?.strictPort).toBe(true);
  });

  it('sets host to localhost only', () => {
    const config = makeConfig();
    const result = buildHarnessConfig(config, '/tmp/project');
    expect(result.server?.host).toBe('localhost');
  });

  it('sets configFile to false when no user vite config exists', () => {
    const config = makeConfig();
    const result = buildHarnessConfig(config, '/tmp/nonexistent-project-xyz');
    expect(result.configFile).toBe(false);
  });

  it('sets root to rootDir', () => {
    const config = makeConfig();
    const result = buildHarnessConfig(config, '/tmp/my-project');
    expect(result.root).toBe('/tmp/my-project');
  });

  it('passes plugins through', () => {
    const config = makeConfig();
    const fakePlugin = { name: 'test-plugin' };
    const result = buildHarnessConfig(config, '/tmp/project', [fakePlugin]);
    expect(result.plugins).toContain(fakePlugin);
  });

  it('sets logLevel to silent', () => {
    const config = makeConfig();
    const result = buildHarnessConfig(config, '/tmp/project');
    expect(result.logLevel).toBe('silent');
  });
});

describe('startHarnessServer', () => {
  let closeServer: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (closeServer) {
      await closeServer();
      closeServer = null;
    }
  });

  it('starts and stops a server', async () => {
    const config = makeConfig({ dashboard: { port: 13001 } });
    const harness = await startHarnessServer(config, process.cwd());
    closeServer = harness.close;

    expect(harness.server).toBeDefined();
    expect(harness.close).toBeInstanceOf(Function);

    await harness.close();
    closeServer = null;
  }, 15000);

  it('logs startup message', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = makeConfig({ dashboard: { port: 13002 } });

    const harness = await startHarnessServer(config, process.cwd());
    closeServer = harness.close;

    expect(logSpy).toHaveBeenCalledWith(
      'PixelProof harness running at http://localhost:13002',
    );
    logSpy.mockRestore();

    await harness.close();
    closeServer = null;
  }, 15000);

  it('close() shuts down server cleanly', async () => {
    const config = makeConfig({ dashboard: { port: 13003 } });
    const harness = await startHarnessServer(config, process.cwd());

    await harness.close();
    // Server should be closed — starting another on same port should work
    const harness2 = await startHarnessServer(config, process.cwd());
    closeServer = harness2.close;

    expect(harness2.server).toBeDefined();

    await harness2.close();
    closeServer = null;
  }, 20000);

  it('throws descriptive error when port is in use', async () => {
    const config = makeConfig({ dashboard: { port: 13004 } });

    // Start first server
    const harness1 = await startHarnessServer(config, process.cwd());

    try {
      // Try to start second server on same port
      await expect(
        startHarnessServer(config, process.cwd()),
      ).rejects.toThrow(
        'Port 13004 is in use. Configure a different port in .pixelproofrc',
      );
    } finally {
      await harness1.close();
    }
  }, 15000);
});
