export type TokenType = 'color' | 'spacing' | 'typography' | 'border-radius' | 'shadow';

export interface TokenEntry {
  resolvedValue: string;
  aliasChain: string[];
  cssVar: string;
  type: TokenType;
}

export interface TokenMap {
  version: string;
  syncedAt: string;
  source: string;
  tokens: Record<string, TokenEntry>;
  lookupByValue: Record<string, string[]>;
  lookupByCssVar: Record<string, string>;
}

export class CyclicAliasError extends Error {
  public chain: string[];

  constructor(chain: string[]) {
    super(`Cyclic alias detected: ${chain.join(' → ')}`);
    this.name = 'CyclicAliasError';
    this.chain = chain;
  }
}

export class MaxDepthError extends Error {
  constructor(depth: number) {
    super(`Alias chain exceeds maximum depth of ${depth}`);
    this.name = 'MaxDepthError';
  }
}
