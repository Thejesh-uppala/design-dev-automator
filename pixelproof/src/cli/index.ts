import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadConfig } from '../config/loader.js';
import { fetchTokens } from '../tokens/fetcher.js';
import { ScoreStore } from '../scoring/store.js';
import { scanAll, scanFile } from '../ast/scanner.js';
import { FileWatcher } from '../watcher/index.js';
import { startServer } from '../server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('pixelproof')
  .description('Catch token violations before code review. Figma-connected. No Storybook required.')
  .version(pkg.version)
  .showHelpAfterError(true);

program
  .command('start')
  .description('Start PixelProof — scan components and launch dashboard')
  .action(async () => {
    try {
      const rootDir = process.cwd();
      const config = loadConfig(rootDir);

      // 1. Sync tokens
      let tokenMap;
      try {
        const result = await fetchTokens(config, rootDir);
        tokenMap = result.tokenMap;
        const tokenCount = Object.keys(tokenMap.tokens).length;
        console.log(
          `Token sync complete: ${tokenCount} tokens from ${result.source} (cached at ${tokenMap.syncedAt})`,
        );
      } catch {
        console.warn(
          "No token data available. Run 'npx pixelproof sync' or add token files to tokens/",
        );
        tokenMap = {
          version: '1',
          syncedAt: new Date().toISOString(),
          source: 'none',
          tokens: {},
          lookupByValue: {},
          lookupByCssVar: {},
        };
      }

      // 2. Full scan
      const scoreStore = new ScoreStore();
      const totalViolations = scanAll(rootDir, config.scan, tokenMap, scoreStore);

      // 3. Print summary
      const aggregate = scoreStore.getAggregateScore();
      console.log(
        `Token Compliance: ${aggregate.tokenCompliance}%. ${totalViolations} violations found.`,
      );

      // Print individual violations
      for (const comp of scoreStore.getAllComponents()) {
        for (const v of comp.violations) {
          console.log(`[VIOLATION] ${v.file}:${v.line}`);
          console.log(`  Found: ${v.prop}="${v.found}"`);
          if (v.nearestToken) {
            console.log(`  Expected token: var(${v.figmaToken || '--' + v.nearestToken.replace(/\//g, '-')})`);
          }
        }
      }

      // 4. Launch Vite dev server + dashboard + WebSocket
      const server = await startServer({
        rootDir,
        config,
        scoreStore,
        tokenMap,
      });

      // 5. Start file watcher for live re-scanning
      const watcher = new FileWatcher(rootDir, config.scan);
      watcher.onChange((event) => {
        if (event.event === 'unlink') return;

        const source = readFileSync(resolve(rootDir, event.file), 'utf-8');
        const result = scanFile(event.file, source, tokenMap);
        const prevScore = scoreStore.getComponentScore(event.file);
        scoreStore.setViolations(event.file, result.violations, result.totalProperties);

        const newScore = scoreStore.getComponentScore(event.file);
        const prevCompliance = prevScore?.tokenCompliance ?? 100;
        const newCompliance = newScore?.tokenCompliance ?? 100;
        const change = newCompliance - prevCompliance;
        const changeStr = change >= 0 ? `+${change.toFixed(1)}` : change.toFixed(1);

        console.log(
          `Rescanned ${event.file}. TC: ${newCompliance}% (${changeStr}). ${result.violations.length} violations.`,
        );
      });

      await watcher.start();
      console.log('Watching for changes... (Ctrl+C to exit)\n');

      // Clean exit on SIGINT
      process.on('SIGINT', async () => {
        await watcher.stop();
        await server.close();
        process.exit(0);
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${msg}`);
      process.exitCode = 1;
    }
  });

program
  .command('sync')
  .description('Sync design tokens from Figma')
  .option('--force', 'Force sync even if cache is fresh')
  .action(async (options: { force?: boolean }) => {
    try {
      const rootDir = process.cwd();
      const config = loadConfig(rootDir);

      const { tokenMap, source } = await fetchTokens(config, rootDir, {
        force: options.force,
      });

      const tokenCount = Object.keys(tokenMap.tokens).length;
      console.log(
        `Token sync complete: ${tokenCount} tokens from ${source} (cached at ${tokenMap.syncedAt})`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${msg}`);
      process.exitCode = 1;
    }
  });

program
  .command('install')
  .description('Install Playwright Chromium for render fidelity scoring')
  .action(async () => {
    try {
      const { installChromium } = await import('../render/playwright-setup.js');
      await installChromium();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${msg}`);
      process.exitCode = 1;
    }
  });

program.parse();
