import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeMCPResponse } from '../figma-mcp.js';
import type { RawFigmaVariables } from '../figma-types.js';

/**
 * Tests for the Figma MCP Client.
 *
 * The MCP client uses dynamic imports for `@modelcontextprotocol/sdk`.
 * We test:
 * 1. normalizeMCPResponse — the pure normalization logic (always testable)
 * 2. fetchViaFigmaMCP behavior — tested via mocked dynamic imports
 */

describe('Figma MCP Client', () => {
  describe('normalizeMCPResponse', () => {
    it('normalizes a standard Figma API response structure', () => {
      const input = {
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

      const result = normalizeMCPResponse(input);

      expect(result.variables['var:1']).toBeDefined();
      expect(result.variables['var:1'].name).toBe('colors/brand/primary');
      expect(result.variables['var:1'].resolvedType).toBe('COLOR');
      expect(result.collections['coll:1']).toBeDefined();
      expect(result.collections['coll:1'].name).toBe('Colors');
    });

    it('handles flat structure (no meta wrapper)', () => {
      const input = {
        variables: {
          'var:1': {
            id: 'var:1',
            name: 'spacing/4',
            resolvedType: 'FLOAT',
            variableCollectionId: 'coll:1',
            valuesByMode: { 'mode:1': 16 },
          },
        },
        variableCollections: {
          'coll:1': {
            id: 'coll:1',
            name: 'Spacing',
            modes: [{ modeId: 'mode:1', name: 'Default' }],
          },
        },
      };

      const result = normalizeMCPResponse(input);

      expect(result.variables['var:1'].name).toBe('spacing/4');
      expect(result.collections['coll:1'].name).toBe('Spacing');
    });

    it('handles empty variables and collections', () => {
      const result = normalizeMCPResponse({ meta: {} });

      expect(Object.keys(result.variables)).toHaveLength(0);
      expect(Object.keys(result.collections)).toHaveLength(0);
    });

    it('uses entry key as id when id field is missing', () => {
      const input = {
        variables: {
          'var:1': {
            name: 'test',
            resolvedType: 'STRING',
            variableCollectionId: 'coll:1',
            valuesByMode: { 'mode:1': 'hello' },
          },
        },
        variableCollections: {},
      };

      const result = normalizeMCPResponse(input);
      expect(result.variables['var:1'].id).toBe('var:1');
    });
  });

  describe('fetchViaFigmaMCP', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      vi.resetModules();
    });

    afterEach(() => {
      process.env = originalEnv;
      vi.restoreAllMocks();
    });

    it('returns null when MCP SDK is not available', async () => {
      // The dynamic import of @modelcontextprotocol/sdk will fail
      // because it's not installed — this is the expected "MCP unavailable" path
      const { fetchViaFigmaMCP } = await import('../figma-mcp.js');
      const result = await fetchViaFigmaMCP('test-file-id');
      expect(result).toBeNull();
    });
  });
});
