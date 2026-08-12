import React from 'react';
import { Canvas, Picture } from '@shopify/react-native-skia';
import type { OrbState } from 'expo-thinking-orbs';

import { useVoiceOrbPicture, type VoiceLevels } from '../hooks';

interface VoiceOrbProps {
  /** Loudness drivers from useOrbLevels. */
  levels: VoiceLevels;
  /** Canvas size in points (the orb fills 86% of it). */
  size: number;
  /** Orb tint — the app's primary colour. */
  color: string;
  /** True on a dark substrate, so the ink runs light. */
  dark: boolean;
  /** Which shipped animation to drive. @default 'listening' */
  state?: OrbState;
  /** 0 = shipped animation untouched, 1 = full voice response. @default 1 */
  reactivity?: number;
  /** Freeze the clock (voice modulation still applies). @default false */
  paused?: boolean;
}

// Renders the voice-reactive orb: a Skia canvas whose picture is rebuilt every
// frame on the UI thread from the loudness drivers. Kept thin so the screen owns
// layout and the render loop lives in useVoiceOrbPicture.
export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  levels,
  size,
  color,
  dark,
  state = 'listening',
  reactivity = 1,
  paused = false,
}) => {
  const picture = useVoiceOrbPicture({
    state,
    size,
    dark,
    color,
    levels,
    reactivity,
    paused,
  });

  return (
    <Canvas style={{ width: size, height: size }}>
      <Picture picture={picture} />
    </Canvas>
  );
};
