# PixelProof

Catch token violations before code review. Figma-connected. No Storybook required.

PixelProof scans your React components for hardcoded colors, spacing, and typography values that should use design tokens, then shows results in a live dashboard.

## Quick Start

### 1. Install

```bash
cd your-react-project
npm install --save-dev pixelproof
```

### 2. Create config

Create `.pixelproofrc.json` in your project root:

```json
{
  "scan": {
    "include": ["src/components/**"],
    "exclude": ["**/*.test.*", "**/*.spec.*"],
    "fileTypes": ["tsx", "jsx"]
  },
  "tokens": {
    "format": "dtcg",
    "fallbackDir": "tokens/"
  },
  "dashboard": {
    "port": 3001
  }
}
```

### 3. Add tokens

Place your design token files in `tokens/` (or wherever `tokens.fallbackDir` points):

```json
// tokens/colors.json (DTCG format)
{
  "color": {
    "primary": {
      "$type": "color",
      "$value": "#6366f1"
    },
    "danger": {
      "$type": "color",
      "$value": "#ef4444"
    }
  }
}
```

### 4. Run

```bash
npx pixelproof start
```

This will:

1. Sync tokens (from Figma API or local token files)
2. Scan all components matching your `include` pattern
3. Launch the dashboard at `http://localhost:3001`
4. Watch for file changes and rescan automatically

Open `http://localhost:3001` to see the dashboard.

## Commands

| Command | Description |
|---------|-------------|
| `npx pixelproof start` | Scan + launch dashboard + watch for changes |
| `npx pixelproof sync` | Sync tokens from Figma (or `--force` to bypass cache) |
| `npx pixelproof install` | Install Playwright Chromium for render fidelity |

## Figma Integration (Optional)

To sync tokens directly from Figma, add a `figma` section:

```json
{
  "figma": {
    "fileId": "YOUR_FIGMA_FILE_ID",
    "personalAccessToken": "${FIGMA_PAT}"
  }
}
```

Set the env var before running:

```bash
export FIGMA_PAT=figd_xxxxx
npx pixelproof start
```

## Render Fidelity (Optional)

PixelProof can also take screenshots of your components and compare them pixel-by-pixel against Figma baselines. This requires Chromium:

```bash
npx pixelproof install
```

Then enable in config and map Figma node IDs:

```json
{
  "render": {
    "enabled": true,
    "viewport": { "width": 1280, "height": 720 },
    "tolerance": 5
  },
  "figma": {
    "fileId": "YOUR_FILE_ID",
    "personalAccessToken": "${FIGMA_PAT}",
    "nodeIds": {
      "Button": "123:456",
      "Card": "789:012"
    }
  }
}
```

## How It Works

1. **Token Sync** -- Fetches design tokens from Figma Variables API or reads local token files (DTCG, Style Dictionary, Token Studio formats).

2. **AST Scanning** -- Parses your JSX/TSX with Babel, walks the AST looking for hardcoded values in `style` props, `sx` props, and CSS-in-JS (`styled()`, `css()`, `makeStyles()`). Compares found values against the token map to detect violations.

3. **Live Dashboard** -- React SPA served on the same Vite dev server. Shows:
   - Token Compliance score (% of style properties using tokens)
   - Per-component violation list with fix suggestions
   - Source code preview with violation highlighting
   - Token reference table with search/filter

4. **File Watching** -- On every save, PixelProof rescans the changed file, updates scores, and pushes changes to the dashboard via WebSocket.

5. **Render Fidelity** (optional) -- Screenshots components in headless Chromium, diffs against Figma baselines, shows side-by-side comparison in the dashboard.

## Dashboard Views

- **Overview** -- Aggregate scores, violation count, sync status
- **Component List** -- Sortable/filterable list of all scanned components
- **Component Detail** -- Drill into violations, source code, and visual diff
- **Token Reference** -- Searchable table of all available tokens

## Configuration Reference

```yaml
# .pixelproofrc.yaml
scan:
  include:
    - "src/components/**"
    - "src/pages/**"
  exclude:
    - "**/*.test.*"
    - "**/*.stories.*"
    - "**/node_modules/**"
  fileTypes:
    - ".tsx"
    - ".jsx"

tokens:
  format: dtcg              # dtcg | style-dictionary | token-studio
  fallbackDir: tokens/      # local token files directory

dashboard:
  port: 3001

render:
  enabled: false            # set true + install Chromium for visual diff
  viewport:
    width: 1280
    height: 720
  tolerance: 5              # pixel diff tolerance (0-255)
  theme: light              # light | dark | system
  providers:                # auto-detected, or specify manually
    - "@chakra-ui/react"
  components:               # mock props for components that need them
    Button:
      mockProps:
        children: "Click me"
        variant: "primary"

figma:
  fileId: ""
  personalAccessToken: "${FIGMA_PAT}"
  syncTTL: 86400            # cache TTL in seconds (default: 24h)
  nodeIds:                  # map component names to Figma node IDs
    Button: "123:456"
```

## What Gets Flagged

PixelProof catches hardcoded values that should use design tokens:

- **Colors**: `color: "#ff0000"` -> `color: var(--color-danger)`
- **Spacing**: `padding: "16px"` -> `padding: var(--spacing-md)`
- **Typography**: `fontSize: "14px"` -> `fontSize: var(--font-size-sm)`
- **Border radius**: `borderRadius: "8px"` -> `borderRadius: var(--radius-md)`
- **Shadows**: `boxShadow: "0 2px 4px..."` -> `boxShadow: var(--shadow-sm)`

Detection works across: inline `style={}`, `sx={}`, `styled()`, `css()`, `makeStyles()`, and SCSS/CSS files.
