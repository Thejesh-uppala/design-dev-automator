export interface FigmaConfig {
  fileId: string;
  personalAccessToken: string;
  syncTTL: number;
  nodeIds?: Record<string, string>;
}

export interface ScanConfig {
  include: string[];
  exclude: string[];
  fileTypes: string[];
}

export interface TokensConfig {
  format: 'dtcg' | 'style-dictionary' | 'token-studio';
  fallbackDir: string;
}

export interface DashboardConfig {
  port: number;
}

export interface ViewportConfig {
  width: number;
  height: number;
}

export interface ComponentRenderConfig {
  mockProps: Record<string, unknown>;
}

export interface RenderConfig {
  enabled: boolean;
  viewport: ViewportConfig;
  tolerance: number;
  theme: 'light' | 'dark' | 'system';
  providers?: string[];
  components?: Record<string, ComponentRenderConfig>;
}

export interface PixelProofConfig {
  figma?: FigmaConfig;
  scan: ScanConfig;
  tokens: TokensConfig;
  dashboard: DashboardConfig;
  render: RenderConfig;
}
