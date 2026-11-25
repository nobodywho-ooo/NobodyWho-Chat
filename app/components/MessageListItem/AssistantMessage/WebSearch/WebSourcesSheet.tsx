import React, { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { openExternalUrl } from 'helpers';
import { hostname } from 'services';
import { Spacings } from 'style';
import type { WebSource } from 'types';

import { PlatformIcon } from '../../../PlatformIcon/PlatformIcon';
import { Text } from '../../../Text/Text';

import { WebFavicon } from './WebFavicon';

const SHEET_ENTER_MS = 260;
const SNAP_BACK_MS = 150;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
const SHEET_RADIUS = 28;
const SHEET_MAX_HEIGHT = '75%';
const BACKDROP_OPACITY = 0.4;
const FAVICON_SIZE = 20;
const PRESSED_OPACITY = 0.6;

interface WebSourcesSheetProps {
  sources: readonly WebSource[];
  visible: boolean;
  onClose: () => void;
}

interface SourceRowProps {
  source: WebSource;
}

const SourceRow: React.FC<SourceRowProps> = ({ source }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { url } = source;
  const host = url ? hostname(url) : undefined;
  const snippetOnly = source.read === false;

  return (
    <Pressable
      onPress={() => url && openExternalUrl(url)}
      disabled={!url}
      accessibilityRole={url ? 'link' : undefined}
      style={({ pressed }) => [
        styles.rowContainer,
        { borderColor: colors.border },
        pressed && styles.pressedContainer,
      ]}
      testID="web-sources-row"
    >
      <View
        style={[
          styles.faviconContainer,
          { backgroundColor: colors.surfaceSecondary },
        ]}
      >
        {url ? (
          <WebFavicon url={url} size={FAVICON_SIZE} />
        ) : (
          <PlatformIcon
            iosIconName="doc.text"
            androidIconName="description"
            size={FAVICON_SIZE}
            color={colors.onSurfaceVariant}
          />
        )}
      </View>
      <View style={styles.rowTextContainer}>
        <Text variant="body2" bold numberOfLines={2}>
          {source.name}
        </Text>
        {(host || snippetOnly) && (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: colors.onSurfaceVariant }}
          >
            {[host, snippetOnly && t('components.messageListItem.snippetOnly')]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </View>
      {url && (
        <PlatformIcon
          iosIconName="arrow.up.right"
          androidIconName="open_in_new"
          size={14}
          color={colors.onSurfaceVariant}
        />
      )}
    </Pressable>
  );
};

export const WebSourcesSheet: React.FC<WebSourcesSheetProps> = ({
  sources,
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);

  useEffect(() => {
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
        translateY.value = withTiming(0, { duration: SNAP_BACK_MS });
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.rootContainer}>
        <Pressable
          style={styles.backdropContainer}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('components.messageListItem.closeSources')}
          testID="web-sources-backdrop"
        />
        <Animated.View
          entering={SlideInDown.duration(SHEET_ENTER_MS)}
          style={[
            styles.sheetContainer,
            { backgroundColor: colors.surface },
            sheetStyle,
          ]}
          testID="web-sources-sheet"
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
                    iosIconName="book"
                    androidIconName="menu_book"
                    size={18}
                    color={colors.onSurface}
                  />
                  <Text variant="body1" bold numberOfLines={1}>
                    {t('components.messageListItem.sourcesTitle', {
                      count: sources.length,
                    })}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'components.messageListItem.closeSources',
                  )}
                  testID="web-sources-close"
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
            contentContainerStyle={[
              styles.listContainer,
              { paddingBottom: insets.bottom + Spacings.lg },
            ]}
            showsVerticalScrollIndicator
          >
            {sources.map((source, index) => (
              <SourceRow
                key={`${index}-${source.url ?? source.name}`}
                source={source}
              />
            ))}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: `rgba(0, 0, 0, ${BACKDROP_OPACITY})`,
  },
  sheetContainer: {
    maxHeight: SHEET_MAX_HEIGHT,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
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
    columnGap: Spacings.sm,
  },
  listContainer: {
    paddingHorizontal: Spacings.lg,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.md,
    paddingVertical: Spacings.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressedContainer: {
    opacity: PRESSED_OPACITY,
  },
  faviconContainer: {
    width: 36,
    height: 36,
    borderRadius: Spacings.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextContainer: {
    flex: 1,
    gap: Spacings.xxs,
  },
});
