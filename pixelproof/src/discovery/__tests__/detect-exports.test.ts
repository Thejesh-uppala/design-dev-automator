import { describe, it, expect } from 'vitest';
import { parseExports } from '../detect-exports.js';

describe('parseExports', () => {
  it('detects export function returning JSX', () => {
    const source = `export function Button() { return <button>Click</button>; }`;
    expect(parseExports(source)).toEqual(['Button']);
  });

  it('detects export const arrow returning JSX', () => {
    const source = `export const Card = () => <div className="card" />;`;
    expect(parseExports(source)).toEqual(['Card']);
  });

  it('detects export const arrow with block body returning JSX', () => {
    const source = `export const Card = () => { return <div className="card" />; };`;
    expect(parseExports(source)).toEqual(['Card']);
  });

  it('detects export default function with name', () => {
    const source = `export default function Modal() { return <div className="modal" />; }`;
    expect(parseExports(source)).toEqual(['Modal']);
  });

  it('detects anonymous export default arrow → "default"', () => {
    const source = `export default () => <div />;`;
    expect(parseExports(source)).toEqual(['default']);
  });

  it('ignores export function without JSX (plain function)', () => {
    const source = `export function helper() { return 42; }`;
    expect(parseExports(source)).toEqual([]);
  });

  it('ignores export const object (not a component)', () => {
    const source = `export const CONFIG = { port: 3000 };`;
    expect(parseExports(source)).toEqual([]);
  });

  it('detects export { Name } named re-export', () => {
    const source = `
      function Button() { return <button />; }
      export { Button };
    `;
    expect(parseExports(source)).toEqual(['Button']);
  });

  it('detects multiple exports from same file', () => {
    const source = `
      export function Button() { return <button />; }
      export const Icon = () => <svg />;
    `;
    const result = parseExports(source);
    expect(result).toContain('Button');
    expect(result).toContain('Icon');
    expect(result).toHaveLength(2);
  });

  it('handles TypeScript source with type annotations', () => {
    const source = `
      interface Props { label: string; }
      export function Button({ label }: Props): JSX.Element {
        return <button>{label}</button>;
      }
    `;
    expect(parseExports(source)).toEqual(['Button']);
  });

  it('ignores type exports', () => {
    const source = `export type ButtonProps = { label: string };`;
    expect(parseExports(source)).toEqual([]);
  });

  it('detects export default identifier referencing a component', () => {
    const source = `
      function Button() { return <button />; }
      export default Button;
    `;
    expect(parseExports(source)).toEqual(['Button']);
  });

  it('ignores export default identifier referencing non-component', () => {
    const source = `
      function helper() { return 42; }
      export default helper;
    `;
    expect(parseExports(source)).toEqual([]);
  });
});
