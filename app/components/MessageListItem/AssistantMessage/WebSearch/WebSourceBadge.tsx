import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { openExternalUrl } from 'helpers';
import { Spacings } from 'style';
import type { WebSource } from 'types';

import { Text } from '../../../Text/Text';

import { WebFavicon } from './WebFavicon';

const FAVICON_SIZE = 14;
const DOT_SIZE = 6;
const PRESSED_OPACITY = 0.6;

interface WebSourceBadgeProps {
  source: WebSource;
}

export const WebSourceBadge: React.FC<WebSourceBadgeProps> = ({ source }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { url } = source;

  const handlePress = useCallback(() => {
    if (url) {
      openExternalUrl(url);
    }
  }, [url]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.badgeContainer,
        {
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.border,
        },
        pressed && styles.pressedContainer,
      ]}
      onPress={handlePress}
      disabled={!url}
      hitSlop={4}
      accessibilityRole={url ? 'link' : undefined}
      testID="web-source-badge"
    >
      {url ? (
        <WebFavicon url={url} size={FAVICON_SIZE} />
      ) : (
        <View
          style={[styles.dotContainer, { backgroundColor: colors.border }]}
        />
      )}
      <Text
        variant="caption"
        numberOfLines={1}
        style={[styles.label, { color: colors.onSurfaceVariant }]}
      >
        {t('components.messageListItem.sourceBadge', { name: source.name })}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacings.xs,
    marginTop: Spacings.sm,
    marginBottom: Spacings.xs,
    paddingVertical: Spacings.xs,
    paddingHorizontal: Spacings.sm,
    borderRadius: Spacings.lg,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  pressedContainer: {
    opacity: PRESSED_OPACITY,
  },
  dotContainer: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  label: {
    flexShrink: 1,
  },
});
