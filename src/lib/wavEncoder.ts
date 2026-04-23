// Wrap 16-bit little-endian mono PCM samples in a minimal RIFF/WAVE header.
// Lets us ship the AudioWorklet's PCM output to OpenAI's transcription
// endpoint without transcoding through a heavier encoder.
// Reference: http://soundfile.sapp.org/doc/WaveFormat/
const SAMPLE_BYTES = 2; // Int16
const CHANNELS = 1;

export function encodeWavFromInt16(samples: Int16Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * SAMPLE_BYTES;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');

  // fmt subchunk — 16-byte PCM format descriptor
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk size
  view.setUint16(20, 1, true); // audio format: PCM
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * CHANNELS * SAMPLE_BYTES, true); // byte rate
  view.setUint16(32, CHANNELS * SAMPLE_BYTES, true); // block align
  view.setUint16(34, SAMPLE_BYTES * 8, true); // bits per sample

  // data subchunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  // PCM payload — little-endian Int16
  const pcm = new Int16Array(buffer, 44, samples.length);
  pcm.set(samples);

  return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
