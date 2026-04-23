#!/usr/bin/env node
// PWA.2: public/apple-touch-icon.png must be 180x180 with no alpha (iOS shows black where alpha is).
// Scope: apple-touch-icon only; manifest icons KEEP alpha for Android adaptive masks.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconPath = path.resolve(__dirname, '..', 'public', 'apple-touch-icon.png');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXPECTED_WIDTH = 180;
const EXPECTED_HEIGHT = 180;

// PNG color types: 0=grayscale, 2=RGB (no alpha); 3=palette (skipped, tRNS smuggles transparency).
const NO_ALPHA_COLOR_TYPES = new Set([0, 2]);

function fail(msg) {
  console.error(`✗ apple-touch-icon check failed: ${msg}`);
  console.error(`  file: ${iconPath}`);
  process.exit(1);
}

let buf;
try {
  buf = readFileSync(iconPath);
} catch (err) {
  fail(`could not read file (${err.code ?? err.message})`);
}

if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
  fail('file is not a valid PNG (bad signature)');
}

// IHDR layout: 8B sig + 4B len + 4B type + 4B width + 4B height + 1B bit-depth + 1B color-type = 26B.
if (buf.length < 26) {
  fail(`truncated PNG: expected at least 26 bytes for signature + IHDR, got ${buf.length}`);
}

const chunkType = buf.subarray(12, 16).toString('ascii');
if (chunkType !== 'IHDR') {
  fail(`expected IHDR as first chunk, got "${chunkType}"`);
}

const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
const colorType = buf.readUInt8(25);

const errors = [];
if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
  errors.push(`dimensions are ${width}x${height}, expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`);
}
if (!NO_ALPHA_COLOR_TYPES.has(colorType)) {
  errors.push(
    `PNG color type is ${colorType} (has alpha or palette). Expected 2 (RGB) or 0 (grayscale). iOS renders alpha as black on the home screen.`,
  );
}

if (errors.length > 0) {
  fail(errors.join('\n  '));
}

console.log(`✓ apple-touch-icon: ${width}x${height}, no alpha, color type ${colorType}`);
