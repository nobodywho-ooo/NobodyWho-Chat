import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import type { WebSearchTraceRow as Row } from 'services';
import { Spacings } from 'style';

import { PlatformIcon } from '../../../PlatformIcon/PlatformIcon';
import { Text } from '../../../Text/Text';

import {
  CONNECTOR_GAP,
  MARKER_SIZE,
  ROW_PADDING_V,
  STEP_DOT_SIZE,
} from './constants';
import { WebFavicon } from './WebFavicon';

interface WebSearchTraceRowProps {
  row: Row;
  isFirst: boolean;
  isLast: boolean;
  onOpen: (url?: string) => void;
  onOpenChallenge: () => void;
}

const PULSE_MS = 700;

const ActiveStepMarker: React.FC<{ color: string }> = ({ color }) => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.55 * pulse.value,
    transform: [{ scale: 0.85 + 0.2 * pulse.value }],
  }));

  return (
    <Animated.View style={pulseStyle} testID="web-search-active-marker">
      <PlatformIcon
        iosIconName="sparkles"
        androidIconName="star_shine"
        size={13}
        color={color}
      />
    </Animated.View>
  );
};

const rowContentEqual = (a: Row, b: Row): boolean => {
  const prev = a as Record<string, unknown>;
  const next = b as Record<string, unknown>;
  const keys = Object.keys(prev);
  return (
    keys.length === Object.keys(next).length &&
    keys.every(key => prev[key] === next[key])
  );
};

// Rows are rebuilt from the trace on every event, so compare by content: an
// unchanged row keeps its pulse and favicon fade instead of restarting them.
const propsEqual = (
  prev: WebSearchTraceRowProps,
  next: WebSearchTraceRowProps,
): boolean =>
  prev.isFirst === next.isFirst &&
  prev.isLast === next.isLast &&
  prev.onOpen === next.onOpen &&
  prev.onOpenChallenge === next.onOpenChallenge &&
  rowContentEqual(prev.row, next.row);

const WebSearchTraceRowComponent: React.FC<WebSearchTraceRowProps> = ({
  row,
  isFirst,
  isLast,
  onOpen,
  onOpenChallenge,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const markerVisible =
    row.type === 'step' && !row.done ? STEP_DOT_SIZE : MARKER_SIZE;
  const inset = (MARKER_SIZE - markerVisible) / 2;
  const muted = colors.onSurfaceDisabled;
  const secondary = colors.onSurfaceVariant;

  const connectors = (
    <>
      {!isFirst && (
        <View
          style={[
            styles.connector,
            styles.connectorAbove,
            {
              backgroundColor: colors.border,
              height: ROW_PADDING_V + inset - CONNECTOR_GAP,
            },
          ]}
        />
      )}
      {!isLast && (
        <View
          style={[
            styles.connector,
            styles.connectorBelow,
            {
              backgroundColor: colors.border,
              top: ROW_PADDING_V + MARKER_SIZE - inset + CONNECTOR_GAP,
            },
          ]}
        />
      )}
    </>
  );

  const stepDot = <View style={[styles.stepDot, { backgroundColor: muted }]} />;

  const marker = (): React.ReactNode => {
    switch (row.type) {
      case 'challenge':
        return (
          <View style={[styles.stepDot, { backgroundColor: colors.primary }]} />
        );
      case 'note':
        return (
          <PlatformIcon
            iosIconName="info.circle"
            androidIconName="info"
            size={14}
            color={row.tone === 'warn' ? colors.warningContent : muted}
          />
        );
      case 'step':
        if (row.done) {
          return (
            <View style={[styles.doneBadge, { borderColor: colors.border }]}>
              <PlatformIcon
                iosIconName="checkmark"
                androidIconName="check"
                size={10}
                color={secondary}
              />
            </View>
          );
        }
        return row.active ? <ActiveStepMarker color={secondary} /> : stepDot;
      case 'page':
        return row.url ? (
          <WebFavicon url={row.url} size={MARKER_SIZE} />
        ) : (
          <PlatformIcon
            iosIconName="globe"
            androidIconName="language"
            size={MARKER_SIZE}
            color={secondary}
          />
        );
    }
  };

  const label = (): React.ReactNode => {
    switch (row.type) {
      case 'challenge':
        return (
          <Text
            variant="caption"
            bold
            numberOfLines={1}
            style={[styles.label, { color: colors.primary }]}
          >
            {t('components.webSearch.challengeRow')}
          </Text>
        );
      case 'note':
        return (
          <Text
            variant="caption"
            numberOfLines={1}
            style={[
              styles.label,
              { color: row.tone === 'warn' ? secondary : muted },
            ]}
          >
            {row.label}
          </Text>
        );
      case 'step':
        return (
          <Text
            variant="caption"
            numberOfLines={1}
            style={[styles.label, { color: secondary }]}
          >
            {row.label}
          </Text>
        );
      case 'page':
        return (
          <Text
            variant="caption"
            bold
            numberOfLines={1}
            style={[
              styles.label,
              { color: row.failed ? muted : secondary },
              row.failed && styles.failed,
            ]}
          >
            {row.host}
            {row.failed && row.note ? (
              <Text variant="caption" style={[styles.detail, { color: muted }]}>
                {`  ${row.note}`}
              </Text>
            ) : row.name && row.name !== row.host ? (
              <Text variant="caption" style={[styles.title, { color: muted }]}>
                {`  ${row.name}`}
              </Text>
            ) : null}
          </Text>
        );
    }
  };

  const pressProps = ((): React.ComponentProps<typeof Pressable> | null => {
    switch (row.type) {
      case 'challenge':
        return {
          onPress: onOpenChallenge,
          accessibilityRole: 'button',
          accessibilityLabel: t('components.webSearch.challengeRowLabel'),
          testID: 'web-search-challenge',
        };
      case 'page':
        return {
          onPress: () => onOpen(row.url),
          disabled: !row.url,
          accessibilityRole: 'link',
          accessibilityLabel: row.name,
          testID: 'web-search-result',
        };
      default:
        return null;
    }
  })();

  const body = (
    <>
      <View style={styles.marker}>{marker()}</View>
      {label()}
    </>
  );

  return (
    <View style={styles.rowWrap}>
      {connectors}
      {pressProps ? (
        <Pressable style={styles.row} {...pressProps}>
          {body}
        </Pressable>
      ) : (
        <View style={styles.row}>{body}</View>
      )}
    </View>
  );
};

export const WebSearchTraceRow = React.memo(
  WebSearchTraceRowComponent,
  propsEqual,
);

const styles = StyleSheet.create({
  rowWrap: {
    position: 'relative',
  },
  connector: {
    position: 'absolute',
    left: (MARKER_SIZE - 1) / 2,
    width: 1,
  },
  connectorAbove: {
    top: 0,
  },
  connectorBelow: {
    bottom: 0,
  },
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBadge: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
    paddingVertical: ROW_PADDING_V,
  },
  stepDot: {
    width: STEP_DOT_SIZE,
    height: STEP_DOT_SIZE,
    borderRadius: STEP_DOT_SIZE / 2,
  },
  label: {
    flex: 1,
  },
  title: {
    fontWeight: 'normal',
  },
  failed: {
    textDecorationLine: 'line-through',
  },
  detail: {
    fontWeight: 'normal',
    textDecorationLine: 'none',
  },
});
