#!/usr/bin/env node
// PWA.2 invariant: public/apple-touch-icon.png must be exactly 180x180
// and have no alpha channel. iOS shows black where alpha is, so an
// alpha-bearing icon renders with a black halo on the home screen.
//
// Scope is intentionally narrow: this script asserts the apple-touch-icon
// only. The 192x192 and 512x512 manifest icons can and should retain alpha
// because Android adaptive icons rely on it for the maskable variant.
// A widened "no alpha on any PNG icon" check would silently break Android
// install rendering.
//
// Pure Node, no deps. Reads the PNG IHDR chunk directly.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconPath = path.resolve(__dirname, '..', 'public', 'apple-touch-icon.png');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXPECTED_WIDTH = 180;
const EXPECTED_HEIGHT = 180;

// PNG color types that carry alpha:
//   4 = grayscale + alpha
//   6 = RGB + alpha
// The two no-alpha types are 0 (grayscale) and 2 (RGB). Palette (3) is
// rejected because it can smuggle transparency via a tRNS chunk and
// asserting "absence of tRNS" adds chunk-walk complexity for a case we
// don't need. iOS-friendly icons should be RGB or grayscale.
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

// PNG signature lives at byte 0
if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
  fail('file is not a valid PNG (bad signature)');
}

// IHDR is always the first chunk after the signature. Layout:
//   bytes  8..11  IHDR length (always 13 for IHDR)
//   bytes 12..15  chunk type ("IHDR")
//   bytes 16..19  width  (big-endian uint32)
//   bytes 20..23  height (big-endian uint32)
//   byte    24    bit depth
//   byte    25    color type
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
