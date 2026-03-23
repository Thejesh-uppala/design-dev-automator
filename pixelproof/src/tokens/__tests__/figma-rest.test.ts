import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchViaFigmaREST, resolvePAT } from '../figma-rest.js';

/**
 * Tests for the Figma REST API Client.
 * Uses vitest's vi.stubGlobal to mock the global fetch function.
 */

function createMockResponse(
  status: number,
  body: unknown,
  statusText: string = 'OK',
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    body: null,
    bodyUsed: false,
    clone: () => createMockResponse(status, body, statusText),
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => JSON.stringify(body),
    bytes: async () => new Uint8Array(),
  } as Response;
}

const sampleLocalResponse = {
  meta: {
    variables: {
      'var:1': {
        id: 'var:1',
        name: 'colors/brand/primary',
        resolvedType: 'COLOR',
        variableCollectionId: 'coll:1',
        valuesByMode: {
          'mode:1': { r: 0, g: 0.314, b: 0.753, a: 1 },
        },
      },
    },
    variableCollections: {
      'coll:1': {
        id: 'coll:1',
        name: 'Colors',
        modes: [{ modeId: 'mode:1', name: 'Light' }],
      },
    },
  },
};

const samplePublishedResponse = {
  meta: {
    variables: {
      'var:2': {
        id: 'var:2',
        name: 'colors/brand/secondary',
        resolvedType: 'COLOR',
        variableCollectionId: 'coll:1',
        valuesByMode: {
          'mode:1': { r: 1, g: 0.5, b: 0, a: 1 },
        },
      },
    },
    variableCollections: {
      'coll:1': {
        id: 'coll:1',
        name: 'Colors',
        modes: [{ modeId: 'mode:1', name: 'Light' }],
      },
    },
  },
};

describe('Figma REST API Client', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('resolvePAT', () => {
    it('returns FIGMA_PAT env var when set', () => {
      process.env.FIGMA_PAT = 'env-token';
      expect(resolvePAT('config-token')).toBe('env-token');
    });

    it('returns config PAT when env var not set', () => {
      delete process.env.FIGMA_PAT;
      expect(resolvePAT('config-token')).toBe('config-token');
    });

    it('returns null when no PAT available', () => {
      delete process.env.FIGMA_PAT;
      expect(resolvePAT()).toBeNull();
    });
  });

  describe('fetchViaFigmaREST', () => {
    it('returns RawFigmaVariables for valid PAT and fileId', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(200, sampleLocalResponse))
        .mockResolvedValueOnce(createMockResponse(200, samplePublishedResponse));

      const result = await fetchViaFigmaREST('test-file-id', 'test-pat');

      expect(result.variables['var:1']).toBeDefined();
      expect(result.variables['var:1'].name).toBe('colors/brand/primary');
      // Published vars merged in
      expect(result.variables['var:2']).toBeDefined();
      expect(result.variables['var:2'].name).toBe('colors/brand/secondary');
    });

    it('sends X-FIGMA-TOKEN header', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(200, sampleLocalResponse))
        .mockResolvedValueOnce(createMockResponse(200, samplePublishedResponse));

      await fetchViaFigmaREST('file-id', 'my-pat');

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[1].headers['X-FIGMA-TOKEN']).toBe('my-pat');
    });

    it('throws descriptive error on 403 (invalid PAT)', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(403, {}, 'Forbidden'));

      await expect(fetchViaFigmaREST('file-id', 'bad-pat')).rejects.toThrow(
        'Figma PAT is invalid or expired. Generate a new token at figma.com/settings',
      );
    });

    it('error message for 403 does NOT contain PAT value', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(403, {}, 'Forbidden'));

      try {
        await fetchViaFigmaREST('file-id', 'secret-token-123');
      } catch (error) {
        expect((error as Error).message).not.toContain('secret-token-123');
      }
    });

    it('throws descriptive error on 404 (file not found)', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(404, {}, 'Not Found'));

      await expect(fetchViaFigmaREST('abc123', 'pat')).rejects.toThrow(
        'Figma file not found: abc123',
      );
    });

    it('retries on 429 with exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(429, {}, 'Too Many Requests'))
        .mockResolvedValueOnce(createMockResponse(200, sampleLocalResponse))
        .mockResolvedValueOnce(createMockResponse(200, samplePublishedResponse));

      const result = await fetchViaFigmaREST('file-id', 'pat');

      expect(result.variables['var:1']).toBeDefined();
      // First call 429'd, second succeeded, third for published
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws after max retries on persistent 429', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(429, {}, 'Too Many Requests'),
      );

      await expect(fetchViaFigmaREST('file-id', 'pat')).rejects.toThrow(
        'rate limit',
      );
    }, 30_000);

    it('returns local-only vars when published endpoint fails', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(200, sampleLocalResponse))
        .mockResolvedValueOnce(createMockResponse(500, {}, 'Internal Server Error'));

      const result = await fetchViaFigmaREST('file-id', 'pat');

      expect(result.variables['var:1']).toBeDefined();
      expect(result.variables['var:2']).toBeUndefined();
    });

    it('local variables take precedence over published on conflict', async () => {
      const conflictPublished = {
        meta: {
          variables: {
            'var:1': {
              id: 'var:1',
              name: 'colors/brand/primary',
              resolvedType: 'COLOR',
              variableCollectionId: 'coll:1',
              valuesByMode: {
                'mode:1': { r: 1, g: 0, b: 0, a: 1 },
              },
            },
          },
          variableCollections: {},
        },
      };

      mockFetch
        .mockResolvedValueOnce(createMockResponse(200, sampleLocalResponse))
        .mockResolvedValueOnce(createMockResponse(200, conflictPublished));

      const result = await fetchViaFigmaREST('file-id', 'pat');

      // Local value should win (r: 0, not r: 1)
      const val = result.variables['var:1'].valuesByMode['mode:1'] as {
        r: number;
      };
      expect(val.r).toBe(0);
    });
  });
});
