import React, { useCallback, useMemo } from 'react';
import { Linking, ScrollView } from 'react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { getMarkdownStyle, log } from 'helpers';
import { useStyled, useThemeMode } from 'hooks';

import styles from './MarkdownDocument.styles';

interface MarkdownDocumentProps {
  markdown: string;
}

export const MarkdownDocument: React.FC<MarkdownDocumentProps> = ({
  markdown,
}) => {
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();

  const markdownStyle = useMemo(
    () => getMarkdownStyle(isDarkMode, colors.onSurface),
    [isDarkMode, colors.onSurface],
  );

  const handleLinkPress = useCallback(({ url }: { url: string }) => {
    Linking.openURL(url).catch(error =>
      log(`Failed to open URL ${url}`, error),
    );
  }, []);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
      contentContainerStyle={styles.content}
    >
      <EnrichedMarkdownText
        markdown={markdown}
        markdownStyle={markdownStyle}
        onLinkPress={handleLinkPress}
      />
    </ScrollView>
  );
};
