import React, {
  ComponentRef,
  RefObject,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { View, ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { BlurView } from 'expo-blur';
import MaskedViewNative from '@react-native-masked-view/masked-view';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from 'context';
import { useStyled } from 'hooks';
import { isAndroid, withAlpha } from 'helpers';

import { AMBIENT_GLOW_HIDE_MS } from '../AmbientGlow/AmbientGlow';
import styles from './GlassScrollEdge.styles';

const BLUR_INTENSITY = isAndroid ? 16 : 8;
const BLUR_REDUCTION_FACTOR = 4;
const BLUR_FADE_HEIGHT = 32;
const TOP_ALPHA = 0.92;
const GRADIENT_STOPS = 10;

const REVEAL_DELAY_MS = AMBIENT_GLOW_HIDE_MS * 0.55;
const REVEAL_MS = AMBIENT_GLOW_HIDE_MS * 0.45;
const HIDE_MS = 200;

const MaskedView = MaskedViewNative as unknown as React.ComponentType<
  ViewProps & { maskElement: React.ReactElement }
>;

const MASK_OPAQUE = '#000000';
const MASK_CLEAR = 'rgba(0, 0, 0, 0)';

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const DIM_STOPS = Array.from({ length: GRADIENT_STOPS + 1 }, (_, i) => {
  const t = i / GRADIENT_STOPS;

  return { location: t, alpha: TOP_ALPHA * (1 - smoothstep(t)) };
});
const DIM_LOCATIONS = DIM_STOPS.map(({ location }) => location);

interface GlassScrollEdgeProps {
  anchor: number;
  blurTarget?: RefObject<ComponentRef<typeof View> | null>;
  visible?: boolean;
}

export const GlassScrollEdge = React.memo(
  ({ anchor, blurTarget, visible = true }: GlassScrollEdgeProps) => {
    const theme = useTheme();
    const { colors } = useStyled();

    const shown = useSharedValue(visible ? 1 : 0);
    const [isBlurOn, setIsBlurOn] = useState(visible);

    useEffect(() => {
      if (!visible) {
        setIsBlurOn(false);
        shown.set(withTiming(0, { duration: HIDE_MS }));

        return;
      }
      shown.set(
        withDelay(
          REVEAL_DELAY_MS,
          withTiming(1, { duration: REVEAL_MS }, finished => {
            if (finished) {
              scheduleOnRN(setIsBlurOn, true);
            }
          }),
        ),
      );
    }, [visible, shown]);

    const dimStyle = useAnimatedStyle(() => ({ opacity: shown.get() }));

    const dimColors = useMemo(
      () => DIM_STOPS.map(({ alpha }) => withAlpha(colors.surface, alpha)),
      [colors.surface],
    );

    if (anchor <= 0) {
      return null;
    }

    const solidUntil = Math.max(0, anchor - BLUR_FADE_HEIGHT) / anchor;
    const canBlur = isBlurOn && (!isAndroid || blurTarget !== undefined);

    return (
      <View pointerEvents="none" style={[styles.container, { height: anchor }]}>
        {canBlur && (
          <MaskedView
            style={[styles.blur, { height: anchor }]}
            maskElement={
              <LinearGradient
                colors={[MASK_OPAQUE, MASK_OPAQUE, MASK_CLEAR]}
                locations={[0, solidUntil, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.fill}
              />
            }
          >
            <BlurView
              tint={
                theme === 'dark'
                  ? 'systemUltraThinMaterialDark'
                  : 'systemUltraThinMaterialLight'
              }
              intensity={BLUR_INTENSITY}
              blurMethod="dimezisBlurViewSdk31Plus"
              blurReductionFactor={BLUR_REDUCTION_FACTOR}
              blurTarget={blurTarget}
              style={styles.fill}
            />
          </MaskedView>
        )}
        <Animated.View style={[styles.fill, dimStyle]}>
          <LinearGradient
            colors={dimColors}
            locations={DIM_LOCATIONS}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.fill}
          />
        </Animated.View>
      </View>
    );
  },
);

GlassScrollEdge.displayName = 'GlassScrollEdge';
