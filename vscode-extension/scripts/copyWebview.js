/**
 * This script copies the built web assets from `web/dist` to `vscode-extension/webview`.
 * This is necessary because the VSCode extension serves the webview content from the `webview` directory.
 * 
 * Usage:
 * 1. Build the web assets: `pnpm --filter web build`
 * 2. Run this script from root: `node vscode-extension/scripts/copyWebview.js`
 */
const fs = require('fs');
const path = require('path');

const webDistPath = path.resolve(__dirname, '../../web/dist');
const targetPath = path.resolve(__dirname, '../webview');

// If the React app hasn't been built yet, we can't copy anything.
if (!fs.existsSync(webDistPath)) {
  console.error('web/dist not found. Run `pnpm --filter web build` first.');
  process.exit(1);
}

// If the 'webview' folder already exists from a previous build, delete it.
if (fs.existsSync(targetPath)) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

fs.mkdirSync(targetPath, { recursive: true });
fs.cpSync(webDistPath, targetPath, { recursive: true });

console.log('✅ Copied web/dist to vscode-extension/webview');