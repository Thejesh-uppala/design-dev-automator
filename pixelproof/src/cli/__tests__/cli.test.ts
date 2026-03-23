import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../../bin/pixelproof.js');

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile('node', [CLI_PATH, ...args], (error, stdout, stderr) => {
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

  it('start command prints stub message and exits 0', async () => {
    const { stdout, exitCode } = await runCli(['start']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Starting PixelProof...');
  });

  it('sync command prints stub message and exits 0', async () => {
    const { stdout, exitCode } = await runCli(['sync']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Syncing tokens...');
  });

  it('install command prints stub message and exits 0', async () => {
    const { stdout, exitCode } = await runCli(['install']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Installing Playwright Chromium...');
  });

  it('unknown command prints error and exits non-zero', async () => {
    const { stderr, exitCode } = await runCli(['badcommand']);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('error');
  });
});
