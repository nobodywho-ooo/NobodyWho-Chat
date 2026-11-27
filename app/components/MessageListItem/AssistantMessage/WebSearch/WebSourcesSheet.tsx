import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { openExternalUrl } from 'helpers';
import { hostname } from 'services';
import type { WebSource } from 'types';

import { PlatformIcon } from '../../../PlatformIcon/PlatformIcon';
import { Sheet, useSheetBottomClearance } from '../../../Sheet/Sheet';
import { Text } from '../../../Text/Text';

import { WebFavicon } from './WebFavicon';

import styles from './WebSourcesSheet.styles';

const FAVICON_SIZE = 20;

interface WebSourcesSheetProps {
  sources: readonly WebSource[];
  visible: boolean;
  onClose: () => void;
}

interface SourceRowProps {
  source: WebSource;
}

const SourceRow: React.FC<SourceRowProps> = ({ source }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { url } = source;
  const host = url ? hostname(url) : undefined;
  const snippetOnly = source.read === false;

  return (
    <Pressable
      onPress={() => url && openExternalUrl(url)}
      disabled={!url}
      accessibilityRole={url ? 'link' : undefined}
      style={({ pressed }) => [
        styles.rowContainer,
        { borderColor: colors.border },
        pressed && styles.pressedContainer,
      ]}
      testID="web-sources-row"
    >
      <View
        style={[
          styles.faviconContainer,
          { backgroundColor: colors.surfaceSecondary },
        ]}
      >
        {url ? (
          <WebFavicon url={url} size={FAVICON_SIZE} />
        ) : (
          <PlatformIcon
            iosIconName="doc.text"
            androidIconName="description"
            size={FAVICON_SIZE}
            color={colors.onSurfaceVariant}
          />
        )}
      </View>
      <View style={styles.rowTextContainer}>
        <Text variant="body2" bold numberOfLines={2}>
          {source.name}
        </Text>
        {(host || snippetOnly) && (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: colors.onSurfaceVariant }}
          >
            {[host, snippetOnly && t('components.messageListItem.snippetOnly')]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </View>
      {url && (
        <PlatformIcon
          iosIconName="arrow.up.right"
          androidIconName="open_in_new"
          size={14}
          color={colors.onSurfaceVariant}
        />
      )}
    </Pressable>
  );
};

export const WebSourcesSheet: React.FC<WebSourcesSheetProps> = ({
  sources,
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
      closeLabel={t('components.messageListItem.closeSources')}
      height="70%"
      testID="web-sources-sheet"
    >
      <View style={styles.titleContainer}>
        <PlatformIcon
          iosIconName="book"
          androidIconName="menu_book"
          size={18}
          color={colors.onSurface}
        />
        <Text variant="body1" bold numberOfLines={1}>
          {t('components.messageListItem.sourcesTitle', {
            count: sources.length,
          })}
        </Text>
      </View>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.listContainer,
          { paddingBottom: bottomClearance },
        ]}
        showsVerticalScrollIndicator
      >
        {sources.map((source, index) => (
          <SourceRow
            key={`${index}-${source.url ?? source.name}`}
            source={source}
          />
        ))}
      </ScrollView>
    </Sheet>
  );
};
