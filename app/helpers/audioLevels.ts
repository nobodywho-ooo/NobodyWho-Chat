// Turns raw audio into the 0–1 loudness drivers that animate the voice orb.
//
// Two sources feed the orb (see useOrbLevels):
//   • the microphone, while the user is talking — analysed live, one call per
//     captured PCM window (micBands);
//   • the synthesized answer, while it plays back — analysed once up front into
//     a time-indexed envelope the render loop samples by playback position
//     (wavToEnvelope), since expo-audio surfaces no per-frame metering.
//
// The band split and normalisation mirror the reference orb's useVoiceLevels so
// both sources read on the orb the same way a human voice does.

/** Loudness window in dBFS: at/below FLOOR reads as silence, at/above CEIL the
 * orb is wide open. Normal phone-mic talking distance sits near −30 dBFS. */
const FLOOR_DB = -62;
const CEIL_DB = -14;

// Crossover corners: < 250 Hz is the body of a vowel, 250 Hz–2 kHz is where
// speech mostly lives, > 2 kHz is consonants and sibilance.
const LOW_HZ = 250;
const MID_HZ = 2000;

// The high band is naturally ~12 dB quieter than the others; lift it so
// sibilance registers instead of sitting on the floor.
const HIGH_TRIM_DB = 12;

/** One captured PCM window reduced to smoothed-input band energies (0–1). */
export interface AudioBands {
  level: number;
  low: number;
  mid: number;
  high: number;
}

/** A whole clip pre-reduced to time-indexed drivers, sampled during playback. */
export interface AudioEnvelope {
  /** Broadband loudness per hop, 0–1. */
  level: number[];
  /** High-band (sibilance) energy per hop, 0–1 — drives the orb's ripple. */
  high: number[];
  /** Milliseconds between successive entries. */
  hopMs: number;
  /** Number of hops (== level.length == high.length). */
  count: number;
  /** Total clip length in milliseconds. */
  durationMs: number;
}

/** dBFS → 0–1 across the loudness window, with a manual trim in dB. */
const normalize = (rms: number, trimDb = 0): number => {
  const db = 20 * Math.log10(rms + 1e-9) + trimDb;
  if (db <= FLOOR_DB) return 0;
  if (db >= CEIL_DB) return 1;
  return (db - FLOOR_DB) / (CEIL_DB - FLOOR_DB);
};

// One-pole coefficient a = 1 − exp(−2π f / fs) for a crossover corner at `hz`.
const poleCoefficient = (hz: number, sampleRate: number): number =>
  1 - Math.exp((-2 * Math.PI * hz) / sampleRate);

// Split `samples` into three bands with two cascaded one-pole low-passes and
// return the RMS of each band plus the broadband RMS. `read` maps an index to a
// normalised −1..1 sample, so the same core serves int16 and float input.
const analyseBands = (
  read: (i: number) => number,
  n: number,
  sampleRate: number,
): { level: number; low: number; mid: number; high: number } => {
  if (n <= 0) {
    return { level: 0, low: 0, mid: 0, high: 0 };
  }

  const aLow = poleCoefficient(LOW_HZ, sampleRate);
  const aMid = poleCoefficient(MID_HZ, sampleRate);

  let lp1 = 0;
  let lp2 = 0;
  let sum = 0;
  let sumLow = 0;
  let sumMid = 0;
  let sumHigh = 0;

  for (let i = 0; i < n; i++) {
    const x = read(i);
    lp1 += aLow * (x - lp1);
    lp2 += aMid * (x - lp2);
    const bLow = lp1;
    const bMid = lp2 - lp1;
    const bHigh = x - lp2;
    sum += x * x;
    sumLow += bLow * bLow;
    sumMid += bMid * bMid;
    sumHigh += bHigh * bHigh;
  }

  return {
    level: Math.sqrt(sum / n),
    low: Math.sqrt(sumLow / n),
    mid: Math.sqrt(sumMid / n),
    high: Math.sqrt(sumHigh / n),
  };
};

/**
 * Reduce one window of mono int16 microphone PCM to normalised band energies.
 * Called once per captured buffer (~30×/s) while the user is talking.
 */
export const micBands = (
  samples: Int16Array,
  sampleRate: number,
): AudioBands => {
  const rms = analyseBands(i => samples[i] / 32768, samples.length, sampleRate);
  return {
    level: normalize(rms.level),
    low: normalize(rms.low),
    mid: normalize(rms.mid),
    high: normalize(rms.high, HIGH_TRIM_DB),
  };
};

interface DecodedWav {
  sampleRate: number;
  /** Mono, −1..1. */
  samples: Float32Array;
}

// Read a four-char little-endian tag.
const tagAt = (bytes: Uint8Array, p: number): string =>
  String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);

// Locate a RIFF subchunk by id, walking word-aligned subchunk headers.
const findChunk = (
  bytes: Uint8Array,
  view: DataView,
  id: string,
): { offset: number; size: number } | null => {
  let p = 12; // Skip "RIFF" + size + "WAVE".
  while (p + 8 <= bytes.length) {
    const size = view.getUint32(p + 4, true);
    if (tagAt(bytes, p) === id) {
      return { offset: p + 8, size };
    }
    p += 8 + size + (size % 2);
  }
  return null;
};

// Decode a WAV (PCM int16, or IEEE float32) to a mono −1..1 stream. Returns null
// on anything it doesn't recognise, so callers can degrade to a silent orb
// rather than throw mid-playback.
const decodeWav = (wav: Uint8Array): DecodedWav | null => {
  if (wav.length < 44 || tagAt(wav, 0) !== 'RIFF' || tagAt(wav, 8) !== 'WAVE') {
    return null;
  }
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

  const fmt = findChunk(wav, view, 'fmt ');
  const data = findChunk(wav, view, 'data');
  if (!fmt || !data) {
    return null;
  }

  const audioFormat = view.getUint16(fmt.offset, true);
  const channels = Math.max(1, view.getUint16(fmt.offset + 2, true));
  const sampleRate = view.getUint32(fmt.offset + 4, true) || 16000;
  const bitsPerSample = view.getUint16(fmt.offset + 14, true);
  const bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
  const frameCount = Math.floor(data.size / (bytesPerSample * channels));
  if (frameCount <= 0) {
    return null;
  }

  const samples = new Float32Array(frameCount);
  const isFloat = audioFormat === 3;

  for (let frame = 0; frame < frameCount; frame++) {
    let acc = 0;
    for (let ch = 0; ch < channels; ch++) {
      const at = data.offset + (frame * channels + ch) * bytesPerSample;
      if (isFloat && bitsPerSample === 32) {
        acc += view.getFloat32(at, true);
      } else if (bitsPerSample === 16) {
        acc += view.getInt16(at, true) / 32768;
      } else if (bitsPerSample === 8) {
        acc += (view.getUint8(at) - 128) / 128;
      } else if (bitsPerSample === 32) {
        acc += view.getInt32(at, true) / 2147483648;
      }
    }
    samples[frame] = acc / channels; // downmix to mono
  }

  return { sampleRate, samples };
};

/** Milliseconds per envelope hop — coarse enough to keep the array small, fine
 * enough that the orb's attack/release smoothing reads as continuous. */
const ENVELOPE_HOP_MS = 30;

/**
 * Pre-analyse a synthesized WAV into a time-indexed loudness envelope the orb's
 * render loop samples by playback position. Runs once per answer, off the frame
 * loop. Returns an empty envelope for audio it can't decode.
 */
export const wavToEnvelope = (
  wav: Uint8Array,
  hopMs: number = ENVELOPE_HOP_MS,
): AudioEnvelope => {
  const decoded = decodeWav(wav);
  if (!decoded || decoded.samples.length === 0) {
    return { level: [], high: [], hopMs, count: 0, durationMs: 0 };
  }

  const { samples, sampleRate } = decoded;
  const hop = Math.max(1, Math.round((sampleRate * hopMs) / 1000));
  const count = Math.ceil(samples.length / hop);

  const level: number[] = new Array(count);
  const high: number[] = new Array(count);

  for (let h = 0; h < count; h++) {
    const start = h * hop;
    const end = Math.min(start + hop, samples.length);
    const n = end - start;

    let sum = 0;
    let sumDiff = 0;
    let prev = start > 0 ? samples[start - 1] : samples[start];
    for (let i = start; i < end; i++) {
      const x = samples[i];
      sum += x * x;
      // First difference approximates high-frequency (consonant) energy without
      // running the full crossover per hop.
      const d = x - prev;
      sumDiff += d * d;
      prev = x;
    }

    level[h] = normalize(Math.sqrt(sum / n));
    high[h] = normalize(Math.sqrt(sumDiff / n), HIGH_TRIM_DB);
  }

  return {
    level,
    high,
    hopMs,
    count,
    durationMs: (samples.length / sampleRate) * 1000,
  };
};
