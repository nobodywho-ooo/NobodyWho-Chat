import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { getMarkdownStyle } from 'helpers';
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

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
      contentContainerStyle={styles.content}
    >
      <EnrichedMarkdownText markdown={markdown} markdownStyle={markdownStyle} />
    </ScrollView>
  );
};
