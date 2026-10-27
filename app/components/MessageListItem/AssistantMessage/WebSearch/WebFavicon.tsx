import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useStyled } from 'hooks';
import { WEB_FAVICON_URL, hostname } from 'services';

import { PlatformIcon } from '../../../PlatformIcon/PlatformIcon';

interface WebFaviconProps {
  url: string;
  size: number;
}

// Favicon fetches fail transiently far more often than for good (the icon
// service is lazily filled), so a miss is retried twice before settling on the
// link glyph.
const RETRY_DELAYS_MS = [2000, 6000];
const FADE_IN_MS = 220;

export const WebFavicon: React.FC<WebFaviconProps> = ({ url, size }) => {
  const { colors } = useStyled();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const host = hostname(url);
  const source = useMemo(
    () => ({
      uri: attempt
        ? `${WEB_FAVICON_URL(host)}?retry=${attempt}`
        : WEB_FAVICON_URL(host),
    }),
    [host, attempt],
  );

  const progress = useSharedValue(0);

  useEffect(() => {
    setFailed(false);
    setAttempt(0);
    progress.value = 0;
  }, [host, progress]);

  useEffect(
    () => () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
    },
    [],
  );

  const faviconStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.82 + progress.value * 0.18 }],
  }));
  const fallbackStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));

  const handleLoad = useCallback(() => {
    progress.value = withTiming(1, { duration: FADE_IN_MS });
  }, [progress]);

  const handleError = useCallback(() => {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined) {
      setFailed(true);
      return;
    }
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
    }
    retryTimer.current = setTimeout(() => setAttempt(attempt + 1), delay);
  }, [attempt]);

  const fallback = (
    <PlatformIcon
      iosIconName="link"
      androidIconName="link"
      size={size}
      color={colors.onSurfaceVariant}
    />
  );

  if (!host || host === url) {
    return fallback;
  }

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, fallbackStyle]}>
        {fallback}
      </Animated.View>
      {!failed && (
        <Animated.Image
          key={attempt}
          source={source}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: size * 0.2 },
            faviconStyle,
          ]}
          onLoad={handleLoad}
          onError={handleError}
          testID="web-favicon"
        />
      )}
    </View>
  );
};
