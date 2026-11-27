import React, { useCallback, useMemo, useRef } from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StreamdownText } from 'react-native-streamdown';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { getMarkdownStyle, openExternalUrl } from 'helpers';
import { useStyled, useThemeMode } from 'hooks';

import { Sheet, useSheetBottomClearance } from '../../Sheet/Sheet';
import { Text } from '../../Text/Text';

import styles from './ThinkingSheet.styles';

interface ThinkingSheetProps {
  thinking: string | null;
  active?: boolean;
  onClose: () => void;
}

export const ThinkingSheet: React.FC<ThinkingSheetProps> = ({
  thinking,
  active = false,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();
  const bottomClearance = useSheetBottomClearance('standard');

  // Kept while the sheet slides away after the reasoning is cleared.
  const shownThinking = useRef(thinking);
  if (thinking !== null) {
    shownThinking.current = thinking;
  }

  const markdownStyle = useMemo(
    () => getMarkdownStyle(isDarkMode, colors.onSurface),
    [isDarkMode, colors.onSurface],
  );

  const Renderer = active ? StreamdownText : EnrichedMarkdownText;

  const handleLinkPress = useCallback(({ url }: { url: string }) => {
    openExternalUrl(url);
  }, []);

  return (
    <Sheet
      visible={thinking !== null}
      onClose={onClose}
      closeLabel={t('components.messageListItem.closeThinking')}
      variant="standard"
      height="60%"
      testID="thinking-sheet"
    >
      <Text variant="body1" bold style={styles.title}>
        {t('components.messageListItem.thinkingTitle')}
      </Text>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomClearance },
        ]}
        showsVerticalScrollIndicator
      >
        {shownThinking.current !== null && (
          <Renderer
            containerStyle={styles.content}
            markdown={shownThinking.current}
            markdownStyle={markdownStyle}
            onLinkPress={handleLinkPress}
          />
        )}
      </ScrollView>
    </Sheet>
  );
};
