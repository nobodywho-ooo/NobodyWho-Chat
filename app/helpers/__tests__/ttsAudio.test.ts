import { Tts } from 'react-native-nobodywho';

import { concatWavs, splitIntoChunks, synthesizeChunked } from '../ttsAudio';

const MAX_CHUNK_CHARS = 350;

// Build a minimal valid PCM WAV (44-byte header + payload) so the RIFF-walking
// concat logic has real chunks to parse.
const buildWav = (data: number[], sampleRate = 24000): Uint8Array => {
  const payload = Uint8Array.from(data);
  const fmtSize = 16;
  const headerSize = 12 + (8 + fmtSize) + 8;
  const out = new Uint8Array(headerSize + payload.length);
  const view = new DataView(out.buffer);
  const tag = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      out[offset + i] = s.charCodeAt(i);
    }
  };
  tag(0, 'RIFF');
  view.setUint32(4, headerSize - 8 + payload.length, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, fmtSize, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  tag(36, 'data');
  view.setUint32(40, payload.length, true);
  out.set(payload, 44);
  return out;
};

const readDataChunk = (wav: Uint8Array): Uint8Array => {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let p = 12;
  while (p + 8 <= wav.length) {
    const id = String.fromCharCode(wav[p], wav[p + 1], wav[p + 2], wav[p + 3]);
    const size = view.getUint32(p + 4, true);
    if (id === 'data') {
      return wav.subarray(p + 8, p + 8 + size);
    }
    p += 8 + size + (size % 2);
  }
  throw new Error('no data chunk');
};

const tag = (wav: Uint8Array, offset: number): string =>
  String.fromCharCode(
    wav[offset],
    wav[offset + 1],
    wav[offset + 2],
    wav[offset + 3],
  );

// --- splitIntoChunks -------------------------------------------------------

describe('splitIntoChunks', () => {
  test('returns nothing for empty or whitespace-only text', () => {
    expect(splitIntoChunks('')).toEqual([]);
    expect(splitIntoChunks('   \n ')).toEqual([]);
  });

  test('returns a single trimmed chunk for short text', () => {
    expect(splitIntoChunks('  Hello world.  ')).toEqual(['Hello world.']);
  });

  test('splits long text into chunks each within the cap', () => {
    const sentence = 'This is a sentence that is reasonably long. ';
    const text = sentence.repeat(30); // ~1300 chars, many sentences
    const chunks = splitIntoChunks(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    }
    // No content is dropped (ignoring whitespace differences at the seams).
    expect(chunks.join(' ').replace(/\s+/g, ' ').trim()).toBe(
      text.replace(/\s+/g, ' ').trim(),
    );
  });

  test('splits an over-long sentence on word boundaries', () => {
    const text = `${'word '.repeat(120)}.`; // one 600-char "sentence"
    const chunks = splitIntoChunks(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    }
  });
});

// --- concatWavs ------------------------------------------------------------

describe('concatWavs', () => {
  test('returns the single WAV unchanged', () => {
    const wav = buildWav([1, 2, 3, 4]);
    expect(concatWavs([wav])).toBe(wav);
  });

  test('concatenates the PCM payloads into one valid WAV', () => {
    const a = buildWav([1, 2, 3, 4]);
    const b = buildWav([5, 6, 7, 8, 9, 10]);
    const out = concatWavs([a, b]);

    expect(tag(out, 0)).toBe('RIFF');
    expect(tag(out, 8)).toBe('WAVE');
    // The combined data chunk is the two payloads back to back.
    expect(Array.from(readDataChunk(out))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // The RIFF chunk size matches the actual byte length.
    const view = new DataView(out.buffer);
    expect(view.getUint32(4, true)).toBe(out.length - 8);
  });

  test('throws when the first WAV has no fmt chunk', () => {
    const bogus = Uint8Array.from([
      ...'RIFF'.split('').map(c => c.charCodeAt(0)),
      0, 0, 0, 0,
      ...'WAVE'.split('').map(c => c.charCodeAt(0)),
    ]);
    expect(() => concatWavs([bogus, buildWav([1])])).toThrow(/fmt/);
  });
});

// --- synthesizeChunked -----------------------------------------------------

describe('synthesizeChunked', () => {
  test('synthesizes short text in a single call', async () => {
    const synthesize = jest.fn(async () => buildWav([42]));
    const synth = { synthesize } as unknown as Tts;

    const wav = await synthesizeChunked(synth, 'Hello world.');

    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(Array.from(readDataChunk(wav))).toEqual([42]);
  });

  test('halves a chunk that trips the phoneme cap and stitches the result', async () => {
    // Reject any call with more than one word, forcing recursive halving down
    // to single words; each single word yields one PCM byte.
    const synthesize = jest.fn(async (text: string) => {
      const words = text.trim().split(/\s+/);
      if (words.length > 1) {
        throw new Error(`Input is 600 phonemes; max 509`);
      }
      return buildWav([words[0].length]);
    });
    const synth = { synthesize } as unknown as Tts;

    const wav = await synthesizeChunked(synth, 'aa bb cc dd');

    // Four words -> four successful single-word syntheses, concatenated.
    expect(Array.from(readDataChunk(wav))).toEqual([2, 2, 2, 2]);
  });

  test('rethrows a non-phoneme error without retrying', async () => {
    const synthesize = jest.fn(async () => {
      throw new Error('backend exploded');
    });
    const synth = { synthesize } as unknown as Tts;

    await expect(synthesizeChunked(synth, 'hello world')).rejects.toThrow(
      'backend exploded',
    );
    // No recursive retry on a non-phoneme error.
    expect(synthesize).toHaveBeenCalledTimes(1);
  });
});
