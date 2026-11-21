import React, { useCallback, useMemo } from 'react';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { getMarkdownStyle, openExternalUrl } from 'helpers';
import { useStyled, useThemeMode } from 'hooks';

import { HeaderScrollView } from '../HeaderScrollView/HeaderScrollView';

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
    openExternalUrl(url);
  }, []);

  return (
    <HeaderScrollView
      style={[styles.container, { backgroundColor: colors.surface }]}
      contentContainerStyle={styles.content}
    >
      <EnrichedMarkdownText
        markdown={markdown}
        markdownStyle={markdownStyle}
        onLinkPress={handleLinkPress}
      />
    </HeaderScrollView>
  );
};
