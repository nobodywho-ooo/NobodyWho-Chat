import React from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';

import { PlatformIcon } from '../../PlatformIcon/PlatformIcon';
import { Sheet, useSheetBottomClearance } from '../../Sheet/Sheet';
import { Text } from '../../Text/Text';

import styles from './ToolCallSheet.styles';

const prettyArguments = (args: Record<string, unknown>): string => {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
};

interface ToolCallSheetProps {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
  visible: boolean;
  onClose: () => void;
}

export const ToolCallSheet: React.FC<ToolCallSheetProps> = ({
  name,
  arguments: callArguments,
  result,
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const bottomClearance = useSheetBottomClearance();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      closeLabel={t('components.messageListItem.closeToolCalls')}
      height="70%"
      testID="tool-call-sheet"
    >
      <View style={styles.titleContainer}>
        <PlatformIcon
          iosIconName="wrench.and.screwdriver"
          androidIconName="build"
          size={18}
          color={colors.onSurface}
        />
        <Text variant="body1" bold numberOfLines={1} style={styles.title}>
          {name}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomClearance },
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
        <Text style={[styles.code, { color: colors.onSurface }]}>{result}</Text>
      </ScrollView>
    </Sheet>
  );
};
