# Streamline icon exports

Export licensed icons from the official VS Code extension into this directory.

- Collection: `Ultimate Regular`
- Format: SVG
- Filename: use the matching `name` from `src/components/icons/streamline-manifest.ts`
- Styling: keep the exported geometry unchanged; `StreamlineIcon` applies color with a CSS mask
- Limit: do not add a new semantic icon without adding it to the manifest first

The workspace setting in `.vscode/settings.json` points the extension to this directory.