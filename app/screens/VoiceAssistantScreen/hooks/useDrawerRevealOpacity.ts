import { useDrawerProgress } from 'expo-router/drawer';
import {
  cancelAnimation,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const FADE_IN_MS = 400;

// The drawer's spring settles within a hair of its bounds, never exactly on them.
const SETTLED_EPSILON = 0.01;

type DrawerPhase = 'open' | 'closed' | 'moving';

export const useDrawerRevealOpacity = (): SharedValue<number> => {
  const progress = useDrawerProgress();
  const opacity = useSharedValue(0);

  useAnimatedReaction(
    (): DrawerPhase =>
      progress.value >= 1 - SETTLED_EPSILON
        ? 'open'
        : progress.value <= SETTLED_EPSILON
          ? 'closed'
          : 'moving',
    (phase, previous) => {
      if (phase === previous) {
        return;
      }

      if (phase === 'open') {
        opacity.value = withTiming(1, { duration: FADE_IN_MS });
      } else if (phase === 'closed') {
        cancelAnimation(opacity);
        opacity.value = 0;
      }
    },
  );

  return opacity;
};
