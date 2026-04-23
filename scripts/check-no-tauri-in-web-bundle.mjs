#!/usr/bin/env node
// PWA.4 invariant: the web build must not contain @tauri-apps/* code.
//
// It's easy to introduce this by accident — any file that imports from
// @tauri-apps/api/* gets pulled into the web bundle unless the import
// is dynamic AND gated by VITE_TARGET. A bundled @tauri-apps module
// either fails at runtime in a regular browser (no window.__TAURI_*)
// or silently bloats the web download with desktop-only code.
//
// Strategy: greps the dist/assets/*.js output for the literal string
// "@tauri-apps/". Minified bundles preserve string literals from
// import paths so a substring match catches both static and dynamic
// imports that the bundler resolved.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist', 'assets');

const FORBIDDEN = '@tauri-apps/';

function fail(msg) {
  console.error(`✗ web bundle invariant failed: ${msg}`);
  process.exit(1);
}

if (!existsSync(distDir)) {
  fail(`dist/assets does not exist. Run \`npm run build:web\` before this check.`);
}

const jsFiles = readdirSync(distDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => path.join(distDir, f));

if (jsFiles.length === 0) {
  fail(`no .js files in ${distDir}. Build output looks empty.`);
}

const violations = [];
for (const file of jsFiles) {
  const contents = readFileSync(file, 'utf8');
  if (contents.includes(FORBIDDEN)) {
    violations.push(path.relative(process.cwd(), file));
  }
}

if (violations.length > 0) {
  console.error(`✗ Found "${FORBIDDEN}" in ${violations.length} web bundle file(s):`);
  for (const v of violations) console.error(`  - ${v}`);
  console.error('');
  console.error('Tauri imports must stay out of the web bundle. Common fixes:');
  console.error('  - Wrap the import in `if (import.meta.env.VITE_TARGET === "tauri")`.');
  console.error('  - Move the import to a dynamic import gated by VITE_TARGET.');
  console.error(
    '  - Use the platform adapter (src/platform/) instead of importing Tauri APIs directly.',
  );
  process.exit(1);
}

console.log(`✓ web bundle: no "${FORBIDDEN}" references in ${jsFiles.length} JS file(s)`);
