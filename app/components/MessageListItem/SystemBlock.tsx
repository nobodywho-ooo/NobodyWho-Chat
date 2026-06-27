import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { Spacings } from 'style';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { Text } from '../Text/Text';

const CARD_BORDER_WIDTH = 1;

interface SystemBlockProps {
  content: string;
}

export const SystemBlock: React.FC<SystemBlockProps> = ({ content }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.headerContainer}>
        <PlatformIcon
          iosIconName="gearshape"
          androidIconName="settings"
          size={14}
          color={colors.onSurfaceVariant}
        />
        <Text
          variant="caption"
          style={[styles.headerLabel, { color: colors.onSurfaceVariant }]}
        >
          {t('components.messageListItem.system')}
        </Text>
      </View>
      <Text style={[styles.content, { color: colors.onSurfaceVariant }]}>
        {content}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    borderWidth: CARD_BORDER_WIDTH,
    borderRadius: 12,
    paddingHorizontal: Spacings.md,
    paddingVertical: Spacings.sm,
    rowGap: Spacings.xs,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.xs,
  },
  headerLabel: {
    includeFontPadding: false,
  },
  content: {
    fontSize: 13,
    lineHeight: 18,
  },
});
