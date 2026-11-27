import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { StreamdownText } from 'react-native-streamdown';
import { getMarkdownStyle } from 'helpers';
import { useStyled, useThemeMode } from 'hooks';
import { Spacings } from 'style';

import { PlatformIcon } from '../../PlatformIcon/PlatformIcon';
import { Text } from '../../Text/Text';

const PREVIEW_LINES = 4;
const PREVIEW_FONT_SIZE = 14;
const PREVIEW_LINE_HEIGHT = 20;
const PREVIEW_HEIGHT = PREVIEW_LINE_HEIGHT * PREVIEW_LINES;
const FADE_HEIGHT = PREVIEW_LINE_HEIGHT;

const CARD_BORDER_WIDTH = 1;
const CARD_PADDING_VERTICAL = Spacings.sm;

interface ThinkingBlockProps {
  thinking: string;
  active: boolean;
  onPress: () => void;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  thinking,
  active,
  onPress,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();

  const markdownStyle = useMemo(() => {
    const base = getMarkdownStyle(isDarkMode, colors.onSurfaceVariant);
    return {
      ...base,
      paragraph: {
        ...(base.paragraph ?? {}),
        fontSize: PREVIEW_FONT_SIZE,
        lineHeight: PREVIEW_LINE_HEIGHT,
      },
    };
  }, [isDarkMode, colors.onSurfaceVariant]);

  const previewThinking = useMemo(
    () =>
      thinking
        .split('\n')
        .filter(line => line.trim().length > 0)
        .join('\n'),
    [thinking],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('components.messageListItem.viewThinking')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.headerContainer}>
        <PlatformIcon
          iosIconName="brain"
          androidIconName="psychology"
          size={14}
          color={colors.onSurfaceVariant}
        />
        <Text
          variant="caption"
          style={[styles.headerLabel, { color: colors.onSurfaceVariant }]}
        >
          {t(
            active
              ? 'components.messageListItem.thinking'
              : 'components.messageListItem.thought',
          )}
        </Text>
      </View>
      <View style={styles.previewContainer}>
        <LinearGradient
          pointerEvents="none"
          colors={[colors.surface, `${colors.surface}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.fadeContainer}
        />
        <View style={styles.previewWindow} pointerEvents="none">
          <View style={styles.previewText}>
            {active ? (
              <StreamdownText
                markdown={previewThinking}
                markdownStyle={markdownStyle}
              />
            ) : (
              <EnrichedMarkdownText
                markdown={previewThinking}
                markdownStyle={markdownStyle}
              />
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    borderWidth: CARD_BORDER_WIDTH,
    borderRadius: 12,
    paddingHorizontal: Spacings.md,
    paddingVertical: CARD_PADDING_VERTICAL,
    marginBottom: Spacings.md,
    rowGap: Spacings.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.xs,
  },
  headerLabel: {
    paddingLeft: Spacings.xxs,
    includeFontPadding: false,
  },
  previewContainer: {
    position: 'relative',
  },
  previewWindow: {
    height: PREVIEW_HEIGHT,
    overflow: 'hidden',
  },
  previewText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: PREVIEW_HEIGHT,
  },
  fadeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
    zIndex: 1,
  },
});
