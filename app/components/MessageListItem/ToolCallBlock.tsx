import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { Spacings } from 'style';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { Text } from '../Text/Text';

const CARD_BORDER_WIDTH = 1;

export const formatArguments = (args: Record<string, unknown>): string =>
  Object.entries(args)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');

interface ToolCallBlockProps {
  name: string;
  arguments: Record<string, unknown>;
  onPress: () => void;
}

export const ToolCallBlock: React.FC<ToolCallBlockProps> = ({
  name,
  arguments: callArguments,
  onPress,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const summary = formatArguments(callArguments);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('components.messageListItem.viewToolCalls')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.headerContainer}>
        <PlatformIcon
          iosIconName="wrench.and.screwdriver"
          androidIconName="build"
          size={14}
          color={colors.onSurfaceVariant}
        />
        <Text
          variant="caption"
          style={[styles.headerLabel, { color: colors.onSurfaceVariant }]}
        >
          {name}
        </Text>
      </View>
      {summary.length > 0 && (
        <Text
          variant="caption"
          numberOfLines={1}
          style={[styles.previewLine, { color: colors.onSurface }]}
        >
          {summary}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    borderWidth: CARD_BORDER_WIDTH,
    borderRadius: 12,
    paddingHorizontal: Spacings.md,
    paddingVertical: Spacings.sm,
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
    includeFontPadding: false,
  },
  previewLine: {
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
});
