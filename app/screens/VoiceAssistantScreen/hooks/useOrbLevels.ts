import { useCallback, useEffect, useMemo } from 'react';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { AudioEnvelope, micBands } from 'helpers';

// The orb's per-frame drivers, all 0–1 and all smoothed on the UI thread — read
// them from the render worklet without a JS hop. Shape matches the reference
// orb's VoiceLevels so useVoiceOrbPicture consumes them unchanged.
export interface VoiceLevels {
  /** Overall loudness. */
  level: SharedValue<number>;
  /** Sub-250 Hz energy — the body of a vowel. */
  low: SharedValue<number>;
  /** 250 Hz–2 kHz energy — where speech mostly lives. */
  mid: SharedValue<number>;
  /** Above 2 kHz — consonants and sibilance. */
  high: SharedValue<number>;
  /** Voice-activity envelope: 1 while sound is flowing, 0 in silence. */
  active: SharedValue<number>;
}

// Which source is currently writing the raw drivers.
const REST = 0;
const MIC = 1;
const PLAYBACK = 2;

// Envelope times. Fast attack so a syllable lands on the frame it happens; slow
// release so the orb settles between words instead of strobing.
const ATTACK_MS = 45;
const RELEASE_MS = 320;

// Voice-activity hysteresis, on the smoothed level.
const VAD_ON = 0.2;
const VAD_OFF = 0.09;

export interface OrbLevelsController {
  levels: VoiceLevels;
  /** Feed one window of mic PCM while listening (call per captured buffer). */
  feedPcm: (samples: Int16Array, sampleRate: number) => void;
  /** Switch to microphone drive and clear any stale energy. */
  listen: () => void;
  /** Switch to playback drive, sampling `envelope` by elapsed time. */
  speak: (envelope: AudioEnvelope) => void;
  /** Let every driver fall back to silence. */
  rest: () => void;
}

/**
 * Owns the orb's loudness drivers and the smoothing loop that animates them,
 * with two interchangeable inputs — live mic PCM ({@link feedPcm}, JS thread)
 * and a pre-analysed playback envelope ({@link speak}, sampled on the UI thread
 * by elapsed frame time). Exactly one is active at a time, so both can write the
 * same raw drivers without contending.
 */
export const useOrbLevels = (): OrbLevelsController => {
  // Raw per-window values (mic) or per-hop samples (playback)…
  const rawLevel = useSharedValue(0);
  const rawLow = useSharedValue(0);
  const rawMid = useSharedValue(0);
  const rawHigh = useSharedValue(0);

  // …and their per-frame envelopes, smoothed on the UI thread.
  const level = useSharedValue(0);
  const low = useSharedValue(0);
  const mid = useSharedValue(0);
  const high = useSharedValue(0);
  const active = useSharedValue(0);
  const speaking = useSharedValue(0);

  const source = useSharedValue<number>(REST);
  const playheadMs = useSharedValue(0);
  const envelope = useSharedValue<AudioEnvelope | null>(null);

  const levels = useMemo<VoiceLevels>(
    () => ({ level, low, mid, high, active }),
    [level, low, mid, high, active],
  );

  const frame = useFrameCallback(info => {
    'worklet';
    let dt = info.timeSincePreviousFrame ?? 16;
    if (dt > 100) dt = 100;

    const src = source.value;
    if (src === PLAYBACK) {
      playheadMs.value += dt;
      const env = envelope.value;
      if (env && env.count > 0) {
        const idx = Math.floor(playheadMs.value / env.hopMs);
        if (idx >= 0 && idx < env.count) {
          const l = env.level[idx];
          rawLevel.value = l;
          rawLow.value = l;
          rawMid.value = l;
          rawHigh.value = env.high[idx];
        } else {
          rawLevel.value = 0;
          rawLow.value = 0;
          rawMid.value = 0;
          rawHigh.value = 0;
        }
      }
    } else if (src === REST) {
      rawLevel.value = 0;
      rawLow.value = 0;
      rawMid.value = 0;
      rawHigh.value = 0;
    }
    // src === MIC: raw* is written from JS by feedPcm between frames.

    const up = 1 - Math.exp(-dt / ATTACK_MS);
    const down = 1 - Math.exp(-dt / RELEASE_MS);
    const follow = (cur: number, target: number) => {
      'worklet';
      return cur + (target - cur) * (target > cur ? up : down);
    };

    const lv = follow(level.value, rawLevel.value);
    level.value = lv;
    low.value = follow(low.value, rawLow.value);
    mid.value = follow(mid.value, rawMid.value);
    high.value = follow(high.value, rawHigh.value);

    // Hysteresis: a louder sound is needed to start "speaking" than to keep it.
    const want = lv > (speaking.value > 0.5 ? VAD_OFF : VAD_ON) ? 1 : 0;
    speaking.value = want;
    active.value = follow(active.value, want);
  }, false);

  useEffect(() => {
    frame.setActive(true);
    return () => frame.setActive(false);
  }, [frame]);

  const feedPcm = useCallback(
    (samples: Int16Array, sampleRate: number) => {
      if (source.value !== MIC) return;
      const bands = micBands(samples, sampleRate);
      rawLevel.value = bands.level;
      rawLow.value = bands.low;
      rawMid.value = bands.mid;
      rawHigh.value = bands.high;
    },
    [source, rawLevel, rawLow, rawMid, rawHigh],
  );

  const zeroRaw = useCallback(() => {
    rawLevel.value = 0;
    rawLow.value = 0;
    rawMid.value = 0;
    rawHigh.value = 0;
  }, [rawLevel, rawLow, rawMid, rawHigh]);

  const listen = useCallback(() => {
    zeroRaw();
    playheadMs.value = 0;
    envelope.value = null;
    source.value = MIC;
  }, [zeroRaw, playheadMs, envelope, source]);

  const speak = useCallback(
    (next: AudioEnvelope) => {
      zeroRaw();
      envelope.value = next;
      playheadMs.value = 0;
      source.value = PLAYBACK;
    },
    [zeroRaw, envelope, playheadMs, source],
  );

  const rest = useCallback(() => {
    source.value = REST;
    envelope.value = null;
    zeroRaw();
  }, [source, envelope, zeroRaw]);

  return useMemo(
    () => ({ levels, feedPcm, listen, speak, rest }),
    [levels, feedPcm, listen, speak, rest],
  );
};
