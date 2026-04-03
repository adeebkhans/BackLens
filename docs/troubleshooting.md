# Troubleshooting

## Graph not showing

Symptoms:

- webview opens but empty
- web app loads with no nodes

Checks:

1. Verify a project has been analyzed.
2. In web mode, verify core-api is running.
3. In extension mode, run BackLens: Show Graph after analysis.
4. Use hotspots load to seed first nodes.

## Analysis fails

Symptoms:

- error message during Analyze Folder

Checks:

1. Confirm selected folder contains supported source files.
2. Confirm workspace has readable file permissions.
3. Re-run analyze on project root instead of nested subfolder.
4. Check extension output/logs for parser or DB errors.

## No project detected

Symptoms:

- Analyze Folder reports no valid root

Checks:

1. Ensure markers exist (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`).
2. Analyze from a folder inside the project, not outside workspace.

## No supported files found

Symptoms:

- analysis succeeds with no meaningful graph nodes

Checks:

1. Confirm code uses supported file types (`.ts`, `.js`, `.tsx`, `.jsx`).
2. Confirm files are not only in ignored directories.

## Source navigation not working

Symptoms:

- double-click node does not open file

Checks:

1. Ensure extension mode (not standalone browser mode).
2. Ensure node metadata includes file and line info.
3. Ensure project is currently loaded/active in extension.

## Webview blank

Symptoms:

- extension graph panel opens white/blank

Checks:

1. Rebuild extension (`pnpm --filter backlens compile`).
2. Verify webview assets exist under `vscode-extension/webview`.
3. Reload window and open graph again.

## DB load failed

Symptoms:

- project appears registered but graph load errors

Checks:

1. Re-analyze project to regenerate DB.
2. Ensure DB path in registry is still valid.
3. Close and reopen project context from BackLens explorer.

## Extension not updating graph after changes

Symptoms:

- graph looks stale after code edits

Checks:

1. Run BackLens: Re-analyze Folder.
2. Refresh BackLens explorer.
3. Reopen graph panel after re-analysis.

## Known causes summary

Common root causes:

- API not running in standalone mode
- stale or missing generated DB
- unsupported language patterns
- analyzing wrong folder root
- assets not rebuilt for extension webview