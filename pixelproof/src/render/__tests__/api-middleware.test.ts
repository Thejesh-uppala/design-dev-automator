import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApiMiddleware } from '../api-middleware.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';

const TEST_DIR = resolve(tmpdir(), 'pixelproof-api-test-' + Date.now());
const PP_DIR = resolve(TEST_DIR, '.pixelproof');

function createMockReq(
  url: string,
  method = 'GET',
): IncomingMessage {
  return { url, method } as unknown as IncomingMessage;
}

function createMockRes(): ServerResponse & {
  _status: number;
  _headers: Record<string, string>;
  _body: string | Buffer;
} {
  const res = {
    _status: 0,
    _headers: {} as Record<string, string>,
    _body: '' as string | Buffer,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      if (headers) Object.assign(res._headers, headers);
    },
    setHeader(key: string, value: string) {
      res._headers[key] = value;
    },
    end(body?: string | Buffer) {
      res._body = body ?? '';
    },
  } as unknown as ServerResponse & {
    _status: number;
    _headers: Record<string, string>;
    _body: string | Buffer;
  };
  return res;
}

beforeEach(() => {
  mkdirSync(resolve(TEST_DIR, 'src/components'), { recursive: true });
  mkdirSync(resolve(PP_DIR, 'screenshots'), { recursive: true });
  mkdirSync(resolve(PP_DIR, 'baselines'), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('API Middleware — /api/source', () => {
  it('returns source file content when file exists', () => {
    writeFileSync(
      resolve(TEST_DIR, 'src/components/Button.tsx'),
      'export const Button = () => <button />;',
    );

    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/source?file=src/components/Button.tsx');
    const res = createMockRes();
    const next = () => {};

    middleware(req, res, next);

    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('text/plain');
    expect(res._body).toBe('export const Button = () => <button />;');
  });

  it('returns 404 when file does not exist', () => {
    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/source?file=src/components/Missing.tsx');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(404);
  });

  it('returns 400 when file param is missing', () => {
    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/source');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(400);
    expect(res._body).toContain('Missing');
  });

  it('returns 400 for path traversal (..)', () => {
    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/source?file=../../etc/passwd');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(400);
    expect(res._body).toContain('Invalid');
  });

  it('returns 400 for absolute paths', () => {
    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/source?file=/etc/passwd');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(400);
  });

  it('sets CORS headers', () => {
    writeFileSync(
      resolve(TEST_DIR, 'src/components/Card.tsx'),
      'export const Card = () => <div />;',
    );

    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/source?file=src/components/Card.tsx');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._headers['Access-Control-Allow-Origin']).toBe('*');
  });
});

describe('API Middleware — /api/screenshot', () => {
  it('returns screenshot PNG when it exists', () => {
    const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    writeFileSync(resolve(PP_DIR, 'screenshots/Button.png'), pngData);

    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/screenshot/Button');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('image/png');
  });

  it('returns 404 when screenshot does not exist', () => {
    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/screenshot/Missing');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(404);
  });
});

describe('API Middleware — /api/baseline', () => {
  it('returns baseline PNG when it exists', () => {
    const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    writeFileSync(resolve(PP_DIR, 'baselines/Button.png'), pngData);

    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/baseline/Button');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('image/png');
  });

  it('returns 404 when baseline does not exist', () => {
    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/baseline/Unmapped');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(404);
  });
});

describe('API Middleware — /api/diff', () => {
  it('returns diff PNG when it exists', () => {
    const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    writeFileSync(resolve(PP_DIR, 'screenshots/Button.diff.png'), pngData);

    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/diff/Button');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('image/png');
  });

  it('returns 404 when diff does not exist', () => {
    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/diff/Missing');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(404);
  });
});

describe('API Middleware — /api/tokens', () => {
  it('returns token cache JSON when it exists', () => {
    const tokenData = {
      version: '1',
      syncedAt: '2024-01-01T00:00:00Z',
      source: 'local',
      tokens: { 'colors/primary': { resolvedValue: '#6366f1' } },
    };
    writeFileSync(
      resolve(PP_DIR, 'token-cache.json'),
      JSON.stringify(tokenData),
    );

    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/tokens');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('application/json');
    const parsed = JSON.parse(res._body as string);
    expect(parsed.source).toBe('local');
  });

  it('returns empty structure when no cache exists', () => {
    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/tokens');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(200);
    const parsed = JSON.parse(res._body as string);
    expect(parsed.tokens).toEqual({});
    expect(parsed.syncedAt).toBeNull();
    expect(parsed.source).toBeNull();
  });
});

describe('API Middleware — general behavior', () => {
  it('calls next() for non-API routes', () => {
    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    let nextCalled = false;
    const req = createMockReq('/some-other-route');
    const res = createMockRes();
    middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('handles CORS preflight OPTIONS request', () => {
    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    const req = createMockReq('/api/tokens', 'OPTIONS');
    const res = createMockRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(204);
    expect(res._headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('calls next() for non-GET methods on non-preflight', () => {
    const middleware = createApiMiddleware({
      rootDir: TEST_DIR,
      pixelproofDir: PP_DIR,
    });

    let nextCalled = false;
    const req = createMockReq('/api/tokens', 'POST');
    const res = createMockRes();
    middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});
