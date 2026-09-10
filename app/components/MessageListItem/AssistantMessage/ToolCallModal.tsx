import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
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
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import { PlatformIcon } from '../../PlatformIcon/PlatformIcon';
import { Text } from '../../Text/Text';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

const prettyArguments = (args: Record<string, unknown>): string => {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
};

interface ToolCallModalProps {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
  visible: boolean;
  onClose: () => void;
}

export const ToolCallModal: React.FC<ToolCallModalProps> = ({
  name,
  arguments: callArguments,
  result,
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      translateY.value = 0;
    }
  }, [visible, translateY]);

  const panGesture = usePanGesture({
    onUpdate: event => {
      translateY.value = Math.max(0, event.translationY);
    },
    onDeactivate: event => {
      const shouldDismiss =
        event.translationY > DISMISS_DISTANCE ||
        event.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        scheduleOnRN(onClose);
      } else {
        translateY.value = withTiming(0, { duration: 150 });
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, DISMISS_DISTANCE * 2], [1, 0.2]),
  }));

  return (
    <Modal
      visible={visible}
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
                <View style={styles.titleContainer}>
                  <PlatformIcon
                    iosIconName="wrench.and.screwdriver"
                    androidIconName="build"
                    size={18}
                    color={colors.onSurface}
                  />
                  <Text
                    variant="body1"
                    bold
                    numberOfLines={1}
                    style={styles.title}
                  >
                    {name}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'components.messageListItem.closeToolCalls',
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
            <Text
              variant="caption"
              style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}
            >
              {t('components.messageListItem.toolArguments')}
            </Text>
            <Text style={[styles.code, { color: colors.onSurface }]}>
              {prettyArguments(callArguments)}
            </Text>

            <Text
              variant="caption"
              style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}
            >
              {t('components.messageListItem.toolResult')}
            </Text>
            <Text style={[styles.code, { color: colors.onSurface }]}>
              {result}
            </Text>
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
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.xs,
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
    rowGap: Spacings.xs,
  },
  sectionLabel: {
    marginTop: Spacings.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  code: {
    fontFamily: 'Courier',
    fontSize: 13,
    lineHeight: 18,
  },
});
