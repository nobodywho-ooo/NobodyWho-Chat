import React, { useEffect, useState } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Text } from 'components';
import { useStyled } from 'hooks';

// The old name drops away and the new one drops in from above, like the discs
// rolling down the wheel.
const OUT = { duration: 140, easing: Easing.in(Easing.cubic) };
const IN = { duration: 260, easing: Easing.out(Easing.cubic) };
const TRAVEL = 10;

interface ModelNameProps {
  name: string;
}

/** The family of the disc in the middle, swapped with a fade as it changes. */
export const ModelName: React.FC<ModelNameProps> = ({ name }) => {
  const { colors } = useStyled();
  const [shown, setShown] = useState(name);

  const visible = useSharedValue(0);
  const leaving = useSharedValue(false);

  useEffect(() => {
    if (name === shown) {
      leaving.value = false;
      visible.value = withTiming(1, IN);
      return;
    }

    // A newer name mid-fade restarts it and drops the old swap.
    leaving.value = true;
    visible.value = withTiming(0, OUT, finished => {
      if (finished) scheduleOnRN(setShown, name);
    });
  }, [name, shown, visible, leaving]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [
      {
        translateY: (1 - visible.value) * (leaving.value ? TRAVEL : -TRAVEL),
      },
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text variant="h2" style={{ color: colors.onSurfaceVariant }}>
        {shown}
      </Text>
    </Animated.View>
  );
};
