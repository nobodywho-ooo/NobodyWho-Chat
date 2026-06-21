import React from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
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
import { Spacings } from 'style';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

interface FullScreenImageModalProps {
  uri: string | null;
  onClose: () => void;
}

export const FullScreenImageModal: React.FC<FullScreenImageModalProps> = ({
  uri,
  onClose,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    if (uri !== null) {
      translateY.value = 0;
    }
  }, [uri, translateY]);

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

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, DISMISS_DISTANCE * 2], [1, 0.2]),
  }));

  return (
    <Modal
      visible={uri !== null}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.rootContainer}>
        <Animated.View style={[styles.backdropContainer, backdropStyle]} />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.gestureContainer}>
            {uri !== null && (
              <Animated.Image
                source={{ uri }}
                style={[styles.image, imageStyle]}
                resizeMode="contain"
                accessibilityRole="image"
              />
            )}
          </Animated.View>
        </GestureDetector>

        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('components.messageListItem.closeImage')}
          style={[styles.closeButton, { top: insets.top + Spacings.md }]}
        >
          <PlatformIcon
            iosIconName="xmark"
            androidIconName="close"
            color="#fff"
            size={24}
          />
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  backdropContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  gestureContainer: {
    flex: 1,
  },
  image: {
    flex: 1,
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    left: Spacings.lg,
  },
});
