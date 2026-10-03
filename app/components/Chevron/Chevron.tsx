import React, { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PlatformIcon } from '../PlatformIcon/PlatformIcon';

const ROTATION_DURATION_MS = 200;

interface ChevronProps {
  expanded: boolean;
  color: string;
  size?: number;
}

export const Chevron: React.FC<ChevronProps> = ({
  expanded,
  color,
  size = 16,
}) => {
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: ROTATION_DURATION_MS,
    });
  }, [expanded, progress]);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <Animated.View style={rotationStyle}>
      <PlatformIcon
        iosIconName="chevron.down"
        androidIconName="keyboard_arrow_down"
        size={size}
        color={color}
      />
    </Animated.View>
  );
};
