#!/usr/bin/env node
// Keeps package.json, src-tauri/Cargo.toml, and src-tauri/tauri.conf.json
// in version lockstep. The Phase 10 update-check compares the running app
// version against the latest GitHub release tag, so drift here breaks it.
//
// Safe to run before Phase 4 lands the src-tauri/ tree: it will just report
// that there is nothing to sync yet.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pkgPath = path.join(root, 'package.json');
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
const confPath = path.join(root, 'src-tauri', 'tauri.conf.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
if (!version) {
  console.error('No version field in package.json');
  process.exit(1);
}

if (!existsSync(path.join(root, 'src-tauri'))) {
  console.log(`src-tauri/ not present yet. Nothing to sync. (package.json @ ${version})`);
  process.exit(0);
}

let updated = 0;

if (existsSync(cargoPath)) {
  const raw = readFileSync(cargoPath, 'utf8');
  // Only replaces the first `version = "x.y.z"` line, which is the one in [package].
  if (!/^version\s*=\s*"[^"]*"/m.test(raw)) {
    console.error(`No [package] version line found in ${path.relative(root, cargoPath)}`);
    process.exit(1);
  }
  const next = raw.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
  if (next !== raw) {
    writeFileSync(cargoPath, next);
    console.log(`Synced ${path.relative(root, cargoPath)} → ${version}`);
    updated++;
  }
}

if (existsSync(confPath)) {
  const conf = JSON.parse(readFileSync(confPath, 'utf8'));
  if (conf.version !== version) {
    conf.version = version;
    writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');
    console.log(`Synced ${path.relative(root, confPath)} → ${version}`);
    updated++;
  }
}

if (updated === 0) {
  console.log(`All versions already in sync at ${version}`);
}
