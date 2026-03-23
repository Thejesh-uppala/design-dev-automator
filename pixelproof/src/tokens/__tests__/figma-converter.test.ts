import { describe, it, expect } from 'vitest';
import {
  convertFigmaVariables,
  figmaColorToHex,
} from '../converters/figma.js';
import type { RawFigmaVariables } from '../figma-types.js';

function createTestVariables(
  overrides: Partial<RawFigmaVariables> = {},
): RawFigmaVariables {
  return {
    variables: {
      'var:1': {
        id: 'var:1',
        name: 'colors/brand/primary',
        resolvedType: 'COLOR',
        variableCollectionId: 'coll:1',
        valuesByMode: {
          'mode:light': { r: 0, g: 80 / 255, b: 192 / 255, a: 1 },
          'mode:dark': { r: 0, g: 0, b: 0, a: 1 },
        },
      },
      ...overrides.variables,
    },
    collections: {
      'coll:1': {
        id: 'coll:1',
        name: 'Colors',
        modes: [
          { modeId: 'mode:light', name: 'Light' },
          { modeId: 'mode:dark', name: 'Dark' },
        ],
      },
      ...overrides.collections,
    },
  };
}

describe('Figma Variable Converter', () => {
  describe('figmaColorToHex', () => {
    it('converts RGBA (0-1) to hex', () => {
      expect(figmaColorToHex({ r: 0, g: 80 / 255, b: 192 / 255, a: 1 })).toBe(
        '#0050c0',
      );
    });

    it('normalizes white', () => {
      expect(figmaColorToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe('#ffffff');
    });

    it('normalizes black', () => {
      expect(figmaColorToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000');
    });

    it('returns rgba() for alpha < 1', () => {
      expect(figmaColorToHex({ r: 1, g: 0, b: 0, a: 0.5 })).toBe(
        'rgba(255, 0, 0, 0.5)',
      );
    });
  });

  describe('convertFigmaVariables', () => {
    it('converts Figma color variable to token with correct value', () => {
      const raw = createTestVariables();
      const result = convertFigmaVariables(raw, 'light');

      expect(result.tokens['colors/brand/primary']).toBeDefined();
      expect(result.tokens['colors/brand/primary'].resolvedValue).toBe(
        '#0050c0',
      );
    });

    it('builds lookupByValue map', () => {
      const raw = createTestVariables();
      const result = convertFigmaVariables(raw, 'light');

      expect(result.lookupByValue['#0050c0']).toContain(
        'colors/brand/primary',
      );
    });

    it('builds lookupByCssVar map', () => {
      const raw = createTestVariables();
      const result = convertFigmaVariables(raw, 'light');

      expect(result.lookupByCssVar['--colors-brand-primary']).toBe(
        'colors/brand/primary',
      );
    });

    it('generates correct cssVar from token path', () => {
      const raw = createTestVariables();
      const result = convertFigmaVariables(raw, 'light');

      expect(result.tokens['colors/brand/primary'].cssVar).toBe(
        '--colors-brand-primary',
      );
    });

    it('maps COLOR type correctly', () => {
      const raw = createTestVariables();
      const result = convertFigmaVariables(raw, 'light');

      expect(result.tokens['colors/brand/primary'].type).toBe('color');
    });

    it('maps FLOAT to spacing by default', () => {
      const raw = createTestVariables({
        variables: {
          'var:spacing': {
            id: 'var:spacing',
            name: 'spacing/4',
            resolvedType: 'FLOAT',
            variableCollectionId: 'coll:1',
            valuesByMode: { 'mode:light': 16 },
          },
        },
      });

      const result = convertFigmaVariables(raw, 'light');
      expect(result.tokens['spacing/4'].type).toBe('spacing');
      expect(result.tokens['spacing/4'].resolvedValue).toBe('16');
    });

    it('maps FLOAT with radius in name to border-radius', () => {
      const raw = createTestVariables({
        variables: {
          'var:radius': {
            id: 'var:radius',
            name: 'border-radius/md',
            resolvedType: 'FLOAT',
            variableCollectionId: 'coll:1',
            valuesByMode: { 'mode:light': 8 },
          },
        },
      });

      const result = convertFigmaVariables(raw, 'light');
      expect(result.tokens['border-radius/md'].type).toBe('border-radius');
    });

    it('uses light mode values when theme is light', () => {
      const raw = createTestVariables();
      const result = convertFigmaVariables(raw, 'light');

      // Light mode value: rgb(0, 80, 192) → #0050c0
      expect(result.tokens['colors/brand/primary'].resolvedValue).toBe(
        '#0050c0',
      );
    });

    it('uses dark mode values when theme is dark', () => {
      const raw = createTestVariables();
      const result = convertFigmaVariables(raw, 'dark');

      // Dark mode value: rgb(0, 0, 0) → #000000
      expect(result.tokens['colors/brand/primary'].resolvedValue).toBe(
        '#000000',
      );
    });

    it('falls back to first mode for unknown theme', () => {
      const raw = createTestVariables();
      const result = convertFigmaVariables(raw, 'custom');

      // First mode is Light → #0050c0
      expect(result.tokens['colors/brand/primary'].resolvedValue).toBe(
        '#0050c0',
      );
    });

    it('resolves Figma alias chains', () => {
      const raw: RawFigmaVariables = {
        variables: {
          'var:alias': {
            id: 'var:alias',
            name: 'colors/primary',
            resolvedType: 'COLOR',
            variableCollectionId: 'coll:1',
            valuesByMode: {
              'mode:1': { type: 'VARIABLE_ALIAS', id: 'var:target' },
            },
          },
          'var:target': {
            id: 'var:target',
            name: 'colors/blue/600',
            resolvedType: 'COLOR',
            variableCollectionId: 'coll:1',
            valuesByMode: {
              'mode:1': { r: 0, g: 80 / 255, b: 192 / 255, a: 1 },
            },
          },
        },
        collections: {
          'coll:1': {
            id: 'coll:1',
            name: 'Colors',
            modes: [{ modeId: 'mode:1', name: 'Light' }],
          },
        },
      };

      const result = convertFigmaVariables(raw, 'light');

      // Alias should resolve to the target's value
      expect(result.tokens['colors/primary'].resolvedValue).toBe('#0050c0');
      // Both tokens should be in lookupByValue
      expect(result.lookupByValue['#0050c0']).toContain('colors/primary');
      expect(result.lookupByValue['#0050c0']).toContain('colors/blue/600');
    });

    it('handles alias chain with aliasChain populated', () => {
      const raw: RawFigmaVariables = {
        variables: {
          'var:alias': {
            id: 'var:alias',
            name: 'colors/primary',
            resolvedType: 'COLOR',
            variableCollectionId: 'coll:1',
            valuesByMode: {
              'mode:1': { type: 'VARIABLE_ALIAS', id: 'var:target' },
            },
          },
          'var:target': {
            id: 'var:target',
            name: 'colors/blue/600',
            resolvedType: 'COLOR',
            variableCollectionId: 'coll:1',
            valuesByMode: {
              'mode:1': { r: 0, g: 0, b: 1, a: 1 },
            },
          },
        },
        collections: {
          'coll:1': {
            id: 'coll:1',
            name: 'Colors',
            modes: [{ modeId: 'mode:1', name: 'Light' }],
          },
        },
      };

      const result = convertFigmaVariables(raw, 'light');
      expect(result.tokens['colors/primary'].aliasChain).toEqual([
        'colors/primary',
        'colors/blue/600',
      ]);
    });

    it('normalizes rgba with alpha=1 to hex', () => {
      const raw: RawFigmaVariables = {
        variables: {
          'var:1': {
            id: 'var:1',
            name: 'colors/test',
            resolvedType: 'COLOR',
            variableCollectionId: 'coll:1',
            valuesByMode: {
              'mode:1': { r: 0, g: 80 / 255, b: 192 / 255, a: 1 },
            },
          },
        },
        collections: {
          'coll:1': {
            id: 'coll:1',
            name: 'Colors',
            modes: [{ modeId: 'mode:1', name: 'Light' }],
          },
        },
      };

      const result = convertFigmaVariables(raw, 'light');
      expect(result.tokens['colors/test'].resolvedValue).toBe('#0050c0');
    });

    it('produces TokenMap with correct metadata', () => {
      const raw = createTestVariables();
      const result = convertFigmaVariables(raw, 'light');

      expect(result.version).toBe('1');
      expect(result.source).toBe('figma');
      expect(result.syncedAt).toBeDefined();
    });

    it('handles STRING type with font in name as typography', () => {
      const raw = createTestVariables({
        variables: {
          'var:font': {
            id: 'var:font',
            name: 'typography/font-family',
            resolvedType: 'STRING',
            variableCollectionId: 'coll:1',
            valuesByMode: { 'mode:light': 'Inter' },
          },
        },
      });

      const result = convertFigmaVariables(raw, 'light');
      expect(result.tokens['typography/font-family'].type).toBe('typography');
      expect(result.tokens['typography/font-family'].resolvedValue).toBe(
        'Inter',
      );
    });
  });
});
