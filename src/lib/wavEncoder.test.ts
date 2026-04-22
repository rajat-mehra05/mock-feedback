import { expect, test } from 'vitest';
import { encodeWavFromInt16 } from './wavEncoder';

test('encoded WAV matches the canonical RIFF/WAVE 16-bit PCM layout that OpenAI accepts', () => {
  // Two samples of PCM data — small enough to inspect every field, large
  // enough to prove the data section and header sizes line up.
  const samples = new Int16Array([0x0001, -0x0001]);
  const wav = encodeWavFromInt16(samples, 16000);

  // Total length: 44-byte header + 4 bytes of PCM.
  expect(wav.byteLength).toBe(48);

  const text = new TextDecoder('ascii').decode(wav.slice(0, 4));
  expect(text).toBe('RIFF');
  expect(new TextDecoder('ascii').decode(wav.slice(8, 12))).toBe('WAVE');
  expect(new TextDecoder('ascii').decode(wav.slice(12, 16))).toBe('fmt ');
  expect(new TextDecoder('ascii').decode(wav.slice(36, 40))).toBe('data');

  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  // RIFF chunk size = file size - 8 = 40
  expect(view.getUint32(4, true)).toBe(40);
  // fmt subchunk size for PCM
  expect(view.getUint32(16, true)).toBe(16);
  // format code 1 = PCM
  expect(view.getUint16(20, true)).toBe(1);
  // mono
  expect(view.getUint16(22, true)).toBe(1);
  // 16kHz
  expect(view.getUint32(24, true)).toBe(16000);
  // byte rate = 16000 * 1 * 2
  expect(view.getUint32(28, true)).toBe(32000);
  // 16 bits per sample
  expect(view.getUint16(34, true)).toBe(16);
  // data size matches the PCM payload
  expect(view.getUint32(40, true)).toBe(4);

  // PCM payload round-trips unchanged (little-endian).
  expect(view.getInt16(44, true)).toBe(1);
  expect(view.getInt16(46, true)).toBe(-1);
});

test('empty samples still produce a structurally valid WAV with zero data size', () => {
  const wav = encodeWavFromInt16(new Int16Array(0), 16000);
  expect(wav.byteLength).toBe(44);
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  expect(view.getUint32(40, true)).toBe(0);
});
