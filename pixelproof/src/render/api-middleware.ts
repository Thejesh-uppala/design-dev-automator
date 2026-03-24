import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, normalize, isAbsolute } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface ApiMiddlewareOptions {
  rootDir: string;
  pixelproofDir: string; // .pixelproof directory path
}

/**
 * Parse URL and query string from a request.
 */
function parseUrl(url: string): { pathname: string; query: URLSearchParams } {
  // Handle URLs that may not have a host
  const parsed = new URL(url, 'http://localhost');
  return { pathname: parsed.pathname, query: parsed.searchParams };
}

/**
 * Check if a file path is safe (no path traversal, not absolute).
 */
function isSafePath(filePath: string): boolean {
  if (isAbsolute(filePath)) return false;
  const normalized = normalize(filePath);
  if (normalized.startsWith('..') || normalized.includes('..')) return false;
  return true;
}

/**
 * Set CORS headers for localhost.
 */
function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Send a JSON response.
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Send a text response.
 */
function sendText(res: ServerResponse, status: number, text: string): void {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(text);
}

/**
 * Send a file as response with given content type.
 */
function sendFile(
  res: ServerResponse,
  filePath: string,
  contentType: string,
): void {
  if (!existsSync(filePath)) {
    setCorsHeaders(res);
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  setCorsHeaders(res);
  const content = readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

/**
 * Handle GET /api/source?file=... — returns source file content.
 */
function handleSource(
  req: IncomingMessage,
  res: ServerResponse,
  options: ApiMiddlewareOptions,
): void {
  const { query } = parseUrl(req.url || '');
  const file = query.get('file');

  if (!file) {
    sendText(res, 400, 'Missing "file" query parameter');
    return;
  }

  if (!isSafePath(file)) {
    sendText(res, 400, 'Invalid file path');
    return;
  }

  const fullPath = resolve(options.rootDir, file);
  if (!existsSync(fullPath)) {
    sendText(res, 404, 'File not found');
    return;
  }

  const content = readFileSync(fullPath, 'utf-8');
  sendText(res, 200, content);
}

/**
 * Handle GET /api/screenshot/:component — serves screenshot PNG.
 */
function handleScreenshot(
  res: ServerResponse,
  component: string,
  options: ApiMiddlewareOptions,
): void {
  const filePath = resolve(
    options.pixelproofDir,
    'screenshots',
    `${component}.png`,
  );
  sendFile(res, filePath, 'image/png');
}

/**
 * Handle GET /api/baseline/:component — serves baseline PNG.
 */
function handleBaseline(
  res: ServerResponse,
  component: string,
  options: ApiMiddlewareOptions,
): void {
  const filePath = resolve(
    options.pixelproofDir,
    'baselines',
    `${component}.png`,
  );
  sendFile(res, filePath, 'image/png');
}

/**
 * Handle GET /api/diff/:component — serves diff PNG.
 */
function handleDiff(
  res: ServerResponse,
  component: string,
  options: ApiMiddlewareOptions,
): void {
  const filePath = resolve(
    options.pixelproofDir,
    'screenshots',
    `${component}.diff.png`,
  );
  sendFile(res, filePath, 'image/png');
}

/**
 * Handle GET /api/tokens — returns token cache JSON.
 */
function handleTokens(
  res: ServerResponse,
  options: ApiMiddlewareOptions,
): void {
  const cachePath = resolve(options.pixelproofDir, 'token-cache.json');

  if (!existsSync(cachePath)) {
    sendJson(res, 200, { tokens: {}, syncedAt: null, source: null });
    return;
  }

  const content = readFileSync(cachePath, 'utf-8');
  try {
    const data = JSON.parse(content);
    sendJson(res, 200, data);
  } catch {
    sendJson(res, 200, { tokens: {}, syncedAt: null, source: null });
  }
}

/**
 * Handle POST /api/baseline/:component — upload a baseline PNG.
 */
function handleBaselineUpload(
  req: IncomingMessage,
  res: ServerResponse,
  component: string,
  options: ApiMiddlewareOptions,
): void {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (body.length === 0) {
      sendText(res, 400, 'Empty body');
      return;
    }
    const baselinesDir = resolve(options.pixelproofDir, 'baselines');
    mkdirSync(baselinesDir, { recursive: true });
    const filePath = resolve(baselinesDir, `${component}.png`);
    writeFileSync(filePath, body);
    sendJson(res, 200, { ok: true, path: filePath });
  });
  req.on('error', () => {
    sendText(res, 500, 'Upload failed');
  });
}

/**
 * Create API middleware handler for the Vite dev server.
 * Returns a Connect-compatible middleware function.
 */
export function createApiMiddleware(
  options: ApiMiddlewareOptions,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  return (req, res, next) => {
    const url = req.url || '';

    // Handle CORS preflight
    if (req.method === 'OPTIONS' && url.startsWith('/api/')) {
      setCorsHeaders(res);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.writeHead(204);
      res.end();
      return;
    }

    const { pathname } = parseUrl(url);

    // POST endpoints
    if (req.method === 'POST') {
      const baselineUpload = pathname.match(/^\/api\/baseline\/([^/]+)$/);
      if (baselineUpload) {
        handleBaselineUpload(req, res, baselineUpload[1], options);
        return;
      }
      next();
      return;
    }

    if (req.method !== 'GET') {
      next();
      return;
    }

    if (pathname === '/api/source') {
      handleSource(req, res, options);
      return;
    }

    if (pathname === '/api/tokens') {
      handleTokens(res, options);
      return;
    }

    // Match /api/screenshot/:component
    const screenshotMatch = pathname.match(/^\/api\/screenshot\/([^/]+)$/);
    if (screenshotMatch) {
      handleScreenshot(res, screenshotMatch[1], options);
      return;
    }

    // Match /api/baseline/:component
    const baselineMatch = pathname.match(/^\/api\/baseline\/([^/]+)$/);
    if (baselineMatch) {
      handleBaseline(res, baselineMatch[1], options);
      return;
    }

    // Match /api/diff/:component
    const diffMatch = pathname.match(/^\/api\/diff\/([^/]+)$/);
    if (diffMatch) {
      handleDiff(res, diffMatch[1], options);
      return;
    }

    next();
  };
}
