import { micBands, wavToEnvelope } from '../audioLevels';

const SAMPLE_RATE = 16000;

// Build a mono 16-bit PCM WAV from −1..1 float samples, matching what the TTS
// engine hands back, so wavToEnvelope has a real header to walk.
const makeWav = (samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array => {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, n * 2, true);

  let offset = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
};

const tone = (
  freq: number,
  seconds: number,
  amp = 0.8,
  sampleRate = SAMPLE_RATE,
): Float32Array => {
  const n = Math.floor(seconds * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
};

const toInt16 = (samples: Float32Array): Int16Array => {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 32768 : s * 32767;
  }
  return out;
};

describe('micBands', () => {
  it('reads silence as zero across every band', () => {
    const bands = micBands(new Int16Array(512), SAMPLE_RATE);
    expect(bands).toEqual({ level: 0, low: 0, mid: 0, high: 0 });
  });

  it('reports non-zero, in-range loudness for speech-band tone', () => {
    const bands = micBands(toInt16(tone(300, 0.05)), SAMPLE_RATE);
    expect(bands.level).toBeGreaterThan(0);
    expect(bands.level).toBeLessThanOrEqual(1);
  });

  it('rises with amplitude', () => {
    const quiet = micBands(toInt16(tone(300, 0.05, 0.05)), SAMPLE_RATE);
    const loud = micBands(toInt16(tone(300, 0.05, 0.9)), SAMPLE_RATE);
    expect(loud.level).toBeGreaterThan(quiet.level);
  });

  it('routes a low tone mostly to the low band', () => {
    const bands = micBands(toInt16(tone(120, 0.05)), SAMPLE_RATE);
    expect(bands.low).toBeGreaterThan(bands.high);
  });
});

describe('wavToEnvelope', () => {
  it('returns an empty envelope for undecodable bytes', () => {
    const env = wavToEnvelope(new Uint8Array([1, 2, 3, 4]));
    expect(env.count).toBe(0);
    expect(env.level).toEqual([]);
    expect(env.high).toEqual([]);
    expect(env.durationMs).toBe(0);
  });

  it('reports silence as a zero envelope of the right length', () => {
    const env = wavToEnvelope(makeWav(new Float32Array(SAMPLE_RATE))); // 1 s
    expect(env.count).toBeGreaterThan(0);
    expect(env.durationMs).toBeCloseTo(1000, 0);
    expect(env.level.every(v => v === 0)).toBe(true);
    expect(env.level).toHaveLength(env.count);
    expect(env.high).toHaveLength(env.count);
  });

  it('produces in-range, non-silent levels for a tone', () => {
    const env = wavToEnvelope(makeWav(tone(300, 0.5)));
    expect(env.count).toBeGreaterThan(0);
    expect(env.level.some(v => v > 0.1)).toBe(true);
    expect(env.level.every(v => v >= 0 && v <= 1)).toBe(true);
    expect(env.high.every(v => v >= 0 && v <= 1)).toBe(true);
  });

  it('honours a custom hop', () => {
    const fine = wavToEnvelope(makeWav(tone(300, 0.5)), 10);
    const coarse = wavToEnvelope(makeWav(tone(300, 0.5)), 60);
    expect(fine.count).toBeGreaterThan(coarse.count);
  });
});
