import { parse } from '@babel/parser';
import type { TraverseOptions } from '@babel/traverse';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';

// Handle CJS/ESM interop for @babel/traverse
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const traverse: (ast: t.Node, opts: TraverseOptions) => void =
  typeof (_traverse as any).default === 'function'
    ? (_traverse as any).default
    : _traverse as any;

/**
 * Check if an AST node (function body) contains any JSX elements or fragments.
 */
function containsJSX(node: t.Node): boolean {
  let found = false;

  traverse(
    t.isFile(node) ? node : t.file(t.program([t.expressionStatement(node as t.Expression)])),
    {
      JSXElement() {
        found = true;
      },
      JSXFragment() {
        found = true;
      },
      noScope: true,
    },
  );

  return found;
}

/**
 * Check if a function body contains JSX.
 */
function functionHasJSX(
  node: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression,
): boolean {
  if (t.isBlockStatement(node.body)) {
    // Traverse the block for JSX
    let found = false;
    const tempAst = t.file(t.program([t.functionDeclaration(
      t.identifier('_temp'),
      node.params,
      node.body,
    )]));
    traverse(tempAst, {
      JSXElement() { found = true; },
      JSXFragment() { found = true; },
      noScope: true,
    });
    return found;
  }

  // Arrow function with expression body: () => <div />
  if (t.isJSXElement(node.body) || t.isJSXFragment(node.body)) {
    return true;
  }

  // Arrow with parenthesized expression
  if (t.isParenthesizedExpression(node.body)) {
    return t.isJSXElement(node.body.expression) || t.isJSXFragment(node.body.expression);
  }

  return false;
}

/**
 * Parse source code and detect exported React component names.
 *
 * A React component is an exported function/arrow that returns JSX.
 * Returns array of export names (e.g., ['Button', 'ButtonIcon']).
 * Anonymous default exports use 'default' as the name.
 */
export function parseExports(source: string): string[] {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    errorRecovery: true,
  });

  const exports: string[] = [];

  // Track top-level function/arrow declarations for default export lookup
  const bindings = new Map<string, t.Node>();

  traverse(ast, {
    // Collect top-level variable/function declarations for binding lookup
    FunctionDeclaration(path) {
      if (path.parent === ast.program && path.node.id) {
        bindings.set(path.node.id.name, path.node);
      }
    },
    VariableDeclaration(path) {
      if (path.parent === ast.program) {
        for (const decl of path.node.declarations) {
          if (t.isIdentifier(decl.id) && decl.init) {
            bindings.set(decl.id.name, decl.init);
          }
        }
      }
    },

    ExportNamedDeclaration(path) {
      const { declaration, specifiers } = path.node;

      // export function Button() { return <button /> }
      if (t.isFunctionDeclaration(declaration) && declaration.id) {
        if (functionHasJSX(declaration)) {
          exports.push(declaration.id.name);
        }
        return;
      }

      // export const Button = () => <div />
      if (t.isVariableDeclaration(declaration)) {
        for (const decl of declaration.declarations) {
          if (!t.isIdentifier(decl.id) || !decl.init) continue;

          if (
            t.isArrowFunctionExpression(decl.init) ||
            t.isFunctionExpression(decl.init)
          ) {
            if (functionHasJSX(decl.init)) {
              exports.push(decl.id.name);
            }
          }
        }
        return;
      }

      // export { Button } — named re-exports
      if (specifiers.length > 0) {
        for (const spec of specifiers) {
          if (t.isExportSpecifier(spec) && t.isIdentifier(spec.exported)) {
            exports.push(spec.exported.name);
          }
        }
      }
    },

    ExportDefaultDeclaration(path) {
      const { declaration } = path.node;

      // export default function Modal() { return <div /> }
      if (t.isFunctionDeclaration(declaration)) {
        if (functionHasJSX(declaration)) {
          exports.push(declaration.id?.name ?? 'default');
        }
        return;
      }

      // export default () => <div />
      if (t.isArrowFunctionExpression(declaration) || t.isFunctionExpression(declaration)) {
        if (functionHasJSX(declaration)) {
          exports.push('default');
        }
        return;
      }

      // export default Button (identifier reference)
      if (t.isIdentifier(declaration)) {
        const binding = bindings.get(declaration.name);
        if (binding) {
          if (
            (t.isFunctionDeclaration(binding) || t.isArrowFunctionExpression(binding) || t.isFunctionExpression(binding)) &&
            functionHasJSX(binding as t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression)
          ) {
            exports.push(declaration.name);
          }
        } else {
          // Can't resolve binding — assume it's a component (conservative)
          exports.push(declaration.name);
        }
      }
    },
  });

  return exports;
}
