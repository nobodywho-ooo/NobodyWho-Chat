import React, { useCallback, useMemo } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { StreamdownText } from 'react-native-streamdown';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { getMarkdownStyle, log } from 'helpers';
import { useStyled, useThemeMode } from 'hooks';
import { Spacings } from 'style';

import { PlatformIcon } from '../../PlatformIcon/PlatformIcon';
import { Text } from '../../Text/Text';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

interface ThinkingModalProps {
  thinking: string | null;
  active?: boolean;
  onClose: () => void;
}

export const ThinkingModal: React.FC<ThinkingModalProps> = ({
  thinking,
  active = false,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);

  const markdownStyle = useMemo(
    () => getMarkdownStyle(isDarkMode, colors.onSurface),
    [isDarkMode, colors.onSurface],
  );

  React.useEffect(() => {
    if (thinking !== null) {
      translateY.value = 0;
    }
  }, [thinking, translateY]);

  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd(event => {
      const shouldDismiss =
        event.translationY > DISMISS_DISTANCE ||
        event.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        scheduleOnRN(onClose);
      } else {
        translateY.value = withTiming(0, { duration: 150 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, DISMISS_DISTANCE * 2], [1, 0.2]),
  }));

  const Renderer = active ? StreamdownText : EnrichedMarkdownText;

  const handleLinkPress = useCallback(({ url }: { url: string }) => {
    Linking.openURL(url).catch(error =>
      log(`Failed to open URL ${url}`, error),
    );
  }, []);

  return (
    <Modal
      visible={thinking !== null}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.rootContainer}>
        <Animated.View style={[styles.backdropContainer, backdropStyle]} />
        <Animated.View
          style={[
            styles.sheetContainer,
            { backgroundColor: colors.surface, paddingTop: insets.top },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={panGesture}>
            <View style={styles.headerContainer}>
              <View
                style={[
                  styles.grabberContainer,
                  { backgroundColor: colors.border },
                ]}
              />
              <View style={styles.headerRowContainer}>
                <Text variant="body1" bold style={styles.title}>
                  {t('components.messageListItem.thinkingTitle')}
                </Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'components.messageListItem.closeThinking',
                  )}
                >
                  <PlatformIcon
                    iosIconName="xmark"
                    androidIconName="close"
                    color={colors.onSurface}
                    size={22}
                  />
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + Spacings.xl },
            ]}
            showsVerticalScrollIndicator
          >
            {thinking !== null && (
              <Renderer
                containerStyle={styles.content}
                markdown={thinking}
                markdownStyle={markdownStyle}
                onLinkPress={handleLinkPress}
              />
            )}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    borderRadius: 10,
  },
  backdropContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  sheetContainer: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: Spacings.lg,
  },
  grabberContainer: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: Spacings.sm,
  },
  headerRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacings.md,
  },
  title: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacings.lg,
    paddingTop: Spacings.sm,
  },
  content: {
    alignItems: 'flex-start',
  },
});
