// A voice-reactive orb, built on `expo-thinking-orbs`' power-user surface —
// `resolvePreset` + `MODES` + `acquireDotBuffer` + `recordPicture`. This is the
// library's own render loop with two additions, ported verbatim from the
// reference orb demo (orb/src/orb/useVoiceOrbPicture.ts):
//
//  1. The clock is elastic. Silence idles below the shipped tempo; a loud
//     syllable pushes it toward ~2×, so the animation itself carries the sense
//     of being listened to.
//  2. A "voice pass" runs over the finished dot cloud before it is recorded —
//     dots swell outward, fatten, ink up, and a radial ripple ruffles the
//     silhouette — so it reacts identically across every shipped state.
//
// The whole thing stays on the UI thread; React never re-renders while sound is
// flowing. The only local change from the demo is where VoiceLevels comes from.

import { useEffect, useMemo } from 'react';
import type { SkPicture } from '@shopify/react-native-skia';
import {
  MODES,
  acquireDotBuffer,
  buildColorLUT,
  pickDesignSize,
  recordPicture,
  resolvePreset,
  type OrbState,
} from 'expo-thinking-orbs';
import {
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type DerivedValue,
} from 'react-native-reanimated';

import type { VoiceLevels } from './useOrbLevels';

// Fraction of the canvas the orb occupies at rest. The remainder is headroom:
// at full reactivity the swell plus ripple push the outer dots out by ~29%.
const ORB_FILL = 0.86;

// Same delta clamp the library uses — a hitch advances the phase, not jumps it.
const MAX_DT_MS = 100;
// The library's deterministic frame for reduced-motion users.
const REDUCED_T = 0.6;

export interface VoiceOrbOptions {
  /** Which of the six shipped animations to drive. */
  state: OrbState;
  /** Canvas size in points. The orb itself fills 86% of it. */
  size: number;
  /** Substrate the orb is drawn on — picks the ink direction. */
  dark: boolean;
  /** Optional tint. */
  color?: string;
  /** Drivers from {@linkcode useOrbLevels}. */
  levels: VoiceLevels;
  /** 0 = the shipped animation untouched, 1 = the tuned voice response. */
  reactivity: number;
  /** Freeze the clock. Voice modulation still applies. */
  paused?: boolean;
}

/** Drive one voice-reactive orb and return its per-frame Skia picture. */
export function useVoiceOrbPicture({
  state,
  size,
  dark,
  color,
  levels,
  reactivity,
  paused = false,
}: VoiceOrbOptions): DerivedValue<SkPicture> {
  const orbSize = size * ORB_FILL;
  const designSize = pickDesignSize(orbSize);
  const resolved = useMemo(
    () => resolvePreset(state, designSize),
    [state, designSize],
  );
  const mode = resolved.mode;
  const opts = resolved.opts;
  const rMin = opts.rMin ?? 0.3;

  const build = MODES[mode].build;
  const staticData = useMemo(() => MODES[mode].precompute(opts), [mode, opts]);
  const dotCount = staticData.dotCount;

  const lut = useMemo(() => buildColorLUT(dark, color), [dark, color]);
  const reduced = useReducedMotion();

  const { level, low, high, active } = levels;

  const speedSV = useSharedValue(resolved.speed);
  const reactSV = useSharedValue(reactivity);
  useEffect(() => {
    speedSV.value = resolved.speed;
  }, [resolved, speedSV]);
  useEffect(() => {
    reactSV.value = reactivity;
  }, [reactivity, reactSV]);

  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = 0;
  }, [state, designSize, phase]);

  const frame = useFrameCallback(info => {
    'worklet';
    let dt = info.timeSincePreviousFrame ?? 0;
    if (dt > MAX_DT_MS) dt = MAX_DT_MS;
    const r = reactSV.value;
    // At r = 0 this is exactly 1 — the shipped tempo. At r = 1 it runs 0.55× in
    // silence and up to ~2× on a loud syllable.
    const tempo = 1 - 0.45 * r + r * (0.45 * active.value + 1.0 * level.value);
    phase.value += (dt / 1000) * speedSV.value * tempo;
  }, false);

  useEffect(() => {
    frame.setActive(!paused && !reduced);
  }, [paused, reduced, frame]);

  return useDerivedValue(() => {
    const t = reduced ? REDUCED_T : phase.value;
    const r = reduced ? 0 : reactSV.value;
    const lvl = level.value;
    const bass = low.value;
    const air = high.value;
    const talk = active.value;

    const buf = acquireDotBuffer(dotCount);
    // expo-thinking-orbs 0.2 added a 6th `dyn` arg to every mode build —
    // device-tilt (`yaw`/`pitch`/`roll`) plus voice-blend (`amp`/`from`/`to`/
    // `mix`). This orb has no device orientation input and resolves a single
    // preset (never the voice-blend mode), so every field is zero: the modes we
    // drive read only yaw/pitch/roll, and amp/from/to/mix are voice-mode only.
    // Omitting it makes `buildWave` read `dyn.yaw` off `undefined` and throw.
    const dyn = { amp: 0, from: 0, to: 0, mix: 0, yaw: 0, pitch: 0, roll: 0 };
    build(buf, orbSize, t, opts, staticData, dyn);

    // --- the voice pass, on the finished dot cloud ------------------------
    // Weighted toward the low band, so a vowel opens the orb and a hiss does
    // not. Peaks at 1.16× when shouting.
    const swell = 1 + 0.16 * r * (0.55 * lvl + 0.45 * bass);
    // Dots fatten and ink up with loudness…
    const fat = 1 + 0.9 * r * lvl;
    const ink = 0.28 * r * lvl;
    // …and the whole cloud sits back in silence, so it visibly wakes up.
    const dim = 1 - 0.35 * r * (1 - talk);
    // A 3- and 5-fold radial ripple on the high band: consonants ruffle the
    // silhouette without moving the body.
    const amp = 0.13 * r * air;
    const rippling = amp > 1e-4;

    // Counter-rotating so the lobes never settle into a standing wave.
    const p3 = t * 2.3;
    const p5 = -t * 1.7;
    const c3 = Math.cos(p3);
    const s3 = Math.sin(p3);
    const c5 = Math.cos(p5);
    const s5 = Math.sin(p5);

    // The cloud is centred on the orb box; re-centre it on the canvas as we go,
    // so the swell has room to grow into.
    const oc = orbSize / 2;
    const cc = size / 2;

    const n = buf.count;
    const xs = buf.xs;
    const ys = buf.ys;
    const rs = buf.rs;
    const ws = buf.ws;
    const as = buf.as;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - oc;
      const dy = ys[i] - oc;
      let k = swell;
      if (rippling) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1e-4) {
          // cos θ / sin θ come free from the normalised offset; multiple-angle
          // identities give sin/cos of 3θ and 5θ for ~10 flops instead of four
          // transcendentals per dot.
          const c = dx / d;
          const s = dy / d;
          const c2 = c * c;
          const s2 = s * s;
          const sin3 = s * (3 - 4 * s2);
          const cos3 = c * (4 * c2 - 3);
          const sin5 = s * (16 * s2 * s2 - 20 * s2 + 5);
          const cos5 = c * (16 * c2 * c2 - 20 * c2 + 5);
          k +=
            amp *
            (0.62 * (sin3 * c3 - cos3 * s3) + 0.38 * (sin5 * c5 - cos5 * s5));
        }
      }
      xs[i] = cc + dx * k;
      ys[i] = cc + dy * k;
      rs[i] *= fat;
      ws[i] -= ink;
      as[i] *= dim;
    }

    return recordPicture(buf, size, lut, rMin);
  }, [build, opts, staticData, dotCount, lut, size, orbSize, rMin, reduced]);
}
