#!/usr/bin/env node
// PWA.4: web bundle must not contain @tauri-apps/* (runtime-fails outside Tauri).
// Greps dist/assets/*.js for the import-path literal; minifier preserves it.

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
