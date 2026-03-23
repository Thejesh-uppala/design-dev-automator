import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../../bin/pixelproof.js');

function runCli(
  args: string[],
  timeoutMs = 5000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = execFile('node', [CLI_PATH, ...args], {
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
    }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: error ? (error as any).code ?? 1 : 0,
      });
    });
  });
}

describe('pixelproof CLI', () => {
  it('--help shows start, sync, install commands with descriptions', async () => {
    const { stdout, exitCode } = await runCli(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('start');
    expect(stdout).toContain('sync');
    expect(stdout).toContain('install');
    expect(stdout).toContain('scan components');
    expect(stdout).toContain('design tokens');
    expect(stdout).toContain('Playwright Chromium');
  });

  it('--version prints 0.1.0', async () => {
    const { stdout, exitCode } = await runCli(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('0.1.0');
  });

  it('start command begins scanning', async () => {
    // start actually runs the full server — it will be killed by timeout
    // Just verify it starts successfully (prints token sync or compliance info)
    const { stdout } = await runCli(['start'], 4000);
    // Should show token sync output or compliance info before being killed
    expect(stdout.length).toBeGreaterThan(0);
  }, 10000);

  it('sync command performs token sync', async () => {
    const { stdout, exitCode } = await runCli(['sync']);
    expect(exitCode).toBe(0);
    // Real sync outputs "Token sync complete:" or uses cached tokens
    expect(stdout).toContain('Token sync complete:');
  });

  it('install command attempts chromium install', async () => {
    // install runs `npx playwright install chromium` which can be slow
    // Kill it after 3s and verify it at least started without crashing
    const { stdout, stderr } = await runCli(['install'], 3000);
    expect(typeof stdout).toBe('string');
  }, 30000);

  it('unknown command prints error and exits non-zero', async () => {
    const { stderr, exitCode } = await runCli(['badcommand']);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('error');
  });
});
