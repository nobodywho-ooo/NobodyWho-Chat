import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useModels, useStyled } from 'hooks';
import { DownloadedModels, PlatformIcon, Text } from 'components';

import styles from './DownloadedModelsScreen.styles';

export const DownloadedModelsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { models } = useModels();
  const navigation = useNavigation();
  const route = useRoute();
  const [deleteMode, setDeleteMode] = useState(false);

  const canDelete = (route.params as { canDelete?: boolean } | undefined)
    ?.canDelete;
  const hasModels = models.length > 0;

  useEffect(() => {
    if (!hasModels && deleteMode) {
      setDeleteMode(false);
    }
  }, [hasModels, deleteMode]);

  const renderHeaderRight = useCallback(() => {
    const showDeleteAction = hasModels && canDelete;
    return (
      <View style={showDeleteAction ? styles.headerActionsContainer : null}>
        {showDeleteAction && (
          <Pressable
            onPress={() => setDeleteMode(mode => !mode)}
            hitSlop={8}
            accessibilityRole="button"
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
    );
  }, [deleteMode, hasModels, canDelete, colors, t]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => renderHeaderRight() });
  }, [navigation, renderHeaderRight]);

  if (!hasModels) {
    return (
      <View style={styles.noModelContainer}>
        <Text variant="h4" style={styles.noModelContainerText}>
          {t('screens.downloadedModels.noModelDownloaded')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <DownloadedModels deleteMode={deleteMode} />
    </ScrollView>
  );
};
