import { useEffect, useMemo, useRef } from 'react';
import {
  Easing,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { VoiceLevels } from 'components';

const STEPS = 10;

const SWELL_MS = 260;
const SETTLE_MS = 1100;

const FADE_FROM = 0.95;
const FADE_STEP_MS = 300;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

const stepOf = (progress: number) => Math.floor(clamp01(progress) * STEPS);

const glowOpacityAt = (progress: number) =>
  clamp01((1 - clamp01(progress)) / (1 - FADE_FROM));

export const useDownloadPulses = (progress: number): VoiceLevels => {
  const level = useSharedValue(0);
  const low = useSharedValue(0);
  const high = useSharedValue(0);
  const active = useSharedValue(0);

  const step = stepOf(progress);
  const lastStep = useRef(step);

  useEffect(() => {
    if (step <= lastStep.current) {
      return;
    }
    lastStep.current = step;
    if (step >= STEPS) {
      return;
    }

    const pulse = () =>
      withSequence(
        withTiming(1, { duration: SWELL_MS, easing: Easing.out(Easing.quad) }),
        withTiming(0, {
          duration: SETTLE_MS,
          easing: Easing.inOut(Easing.quad),
        }),
      );
    level.set(pulse());
    low.set(pulse());
    high.set(pulse());
  }, [step, level, low, high]);

  return useMemo(
    () => ({ level, low, high, active }),
    [level, low, high, active],
  );
};

export const useDownloadGlowOpacity = (
  progress: number,
): SharedValue<number> => {
  const target = glowOpacityAt(progress);
  const opacity = useSharedValue(target);

  useEffect(() => {
    opacity.set(
      withTiming(target, { duration: FADE_STEP_MS, easing: Easing.linear }),
    );
  }, [target, opacity]);

  return opacity;
};
