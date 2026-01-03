// esbuild.config.mjs

import * as esbuild from 'esbuild';

// Extension bundle (Node.js)
await esbuild.build({
  entryPoints: ['src/extension/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
});

// Webview bundle (Browser)
await esbuild.build({
  entryPoints: ['src/webview/main.ts'],
  bundle: true,
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
});