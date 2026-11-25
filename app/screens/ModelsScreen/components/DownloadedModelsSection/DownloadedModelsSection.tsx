import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DownloadedModels, PlatformIcon, Text } from 'components';
import { useModels, useStyled } from 'hooks';

import styles from './DownloadedModelsSection.styles';

export const DownloadedModelsSection: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { models } = useModels();
  const [deleteMode, setDeleteMode] = useState(false);

  const hasModels = models.length > 0;

  useEffect(() => {
    if (!hasModels && deleteMode) {
      setDeleteMode(false);
    }
  }, [hasModels, deleteMode]);

  return (
    <>
      <View style={styles.headerContainer}>
        <Text variant="h4">{t('screens.models.downloaded')}</Text>
        {hasModels && (
          <Pressable
            onPress={() => setDeleteMode(mode => !mode)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              deleteMode
                ? t('common.cancel')
                : t('screens.downloadedModels.delete')
            }
          >
            {deleteMode ? (
              <Text variant="body1" bold style={{ color: colors.primary }}>
                {t('common.cancel')}
              </Text>
            ) : (
              <PlatformIcon
                iosIconName="trash"
                androidIconName="delete"
                color={colors.dangerSurface}
                size={22}
              />
            )}
          </Pressable>
        )}
      </View>

      {hasModels ? (
        <DownloadedModels deleteMode={deleteMode} />
      ) : (
        <Text>{t('screens.downloadedModels.noModelDownloaded')}</Text>
      )}
    </>
  );
};
