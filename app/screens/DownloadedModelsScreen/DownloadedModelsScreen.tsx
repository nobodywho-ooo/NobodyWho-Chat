import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppState, useModels, useStyled } from 'hooks';
import { DEFAULT_ASSISTANT_CONFIG, getAppState, setAppState } from 'database';
import { deleteModel, getDocumentPathsByModelId } from 'repositories';
import {
  deleteMessageDocuments,
  deleteModelFiles,
  isIOS,
  log,
  resolveTtsPrefs,
} from 'helpers';
import { ModelCard, PlatformIcon, Text } from 'components';
import { useAiService } from 'services';
import {
  Model,
  ModelPipeline,
  isTtsPipeline,
  isSttPipeline,
  isChatPipeline,
} from 'types';

import styles from './DownloadedModelsScreen.styles';

export const DownloadedModelsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { models } = useModels();
  const { modelIdInUse, ttsModelIdInUse, sttModelIdInUse } = useAppState();
  const { chat, disposeTts, disposeStt, disposeChat } = useAiService();
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

  const handleDeleteModel = useCallback(
    async (model: Model) => {
      try {
        const documentPaths = await getDocumentPathsByModelId(model.id);

        if (ttsModelIdInUse === model.id) {
          disposeTts();
          await setAppState({ ttsModelIdInUse: undefined });
        }

        if (sttModelIdInUse === model.id) {
          disposeStt();
          await setAppState({ sttModelIdInUse: undefined });
        }

        if (modelIdInUse === model.id && isChatPipeline(model.pipeline)) {
          disposeChat();
        }

        const filesDeleted = await deleteModelFiles(model);
        if (!filesDeleted) {
          throw new Error('files not deleted');
        }

        await deleteModel(model.id);
        await deleteMessageDocuments(documentPaths);

        if (modelIdInUse === model.id) {
          await setAppState({
            modelIdInUse: undefined,
            conversationIdInUse: undefined,
          });
        }
      } catch (error) {
        log('DownloadedModelsScreen handleDeleteModel', error);
      }
    },
    [
      modelIdInUse,
      ttsModelIdInUse,
      sttModelIdInUse,
      disposeTts,
      disposeStt,
      disposeChat,
    ],
  );

  const confirmDeleteModel = useCallback(
    (model: Model) => {
      Alert.alert(
        t('screens.downloadedModels.deleteConfirmTitle'),
        t('screens.downloadedModels.deleteConfirmMessage', {
          model: model.name,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('screens.downloadedModels.delete'),
            style: 'destructive',
            onPress: () => handleDeleteModel(model),
          },
        ],
      );
    },
    [t, handleDeleteModel],
  );

  const handleModelPress = useCallback(
    (model: Model) => {
      if (deleteMode) {
        confirmDeleteModel(model);
        return;
      }

      if (isTtsPipeline(model.pipeline)) {
        if (ttsModelIdInUse !== model.id) {
          // Stamp the model's voice/language defaults into the config as it
          // takes the voice slot, so the loader and picker read them directly.
          const config =
            getAppState().assistantConfig ?? DEFAULT_ASSISTANT_CONFIG;
          setAppState({
            ttsModelIdInUse: model.id,
            assistantConfig: { ...config, ...resolveTtsPrefs(model, config) },
          });
          navigation.goBack();
        }
        return;
      }

      if (isSttPipeline(model.pipeline)) {
        if (sttModelIdInUse !== model.id) {
          setAppState({ sttModelIdInUse: model.id });
          navigation.goBack();
        }
        return;
      }

      if (modelIdInUse !== model.id) {
        // Stop any in-flight generation before the model switch tears down
        // the current chat, so a live stream ends cleanly rather than being
        // cut off mid-token as the backend is swapped out.
        chat.current?.stopGeneration();
        setAppState({
          modelIdInUse: model.id,
          conversationIdInUse: undefined,
        });
        navigation.goBack();
      }
    },
    [
      deleteMode,
      confirmDeleteModel,
      modelIdInUse,
      ttsModelIdInUse,
      sttModelIdInUse,
      chat,
      navigation,
    ],
  );

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
        {isIOS && (
          <Pressable onPress={navigation.goBack} accessibilityRole="button">
            <PlatformIcon
              iosIconName="xmark"
              androidIconName="close"
              color={colors.onSurface}
              size={22}
            />
          </Pressable>
        )}
      </View>
    );
  }, [navigation, deleteMode, hasModels, canDelete, colors, t]);

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

  const inUseIdFor = (pipeline: ModelPipeline) => {
    if (isTtsPipeline(pipeline)) {
      return ttsModelIdInUse;
    }
    if (isSttPipeline(pipeline)) {
      return sttModelIdInUse;
    }

    return modelIdInUse;
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      {models.map(model => (
        <ModelCard
          key={model.id}
          isDownloaded
          deleteMode={deleteMode}
          isSelected={inUseIdFor(model.pipeline) === model.id}
          model={model}
          onPress={handleModelPress}
        />
      ))}
    </ScrollView>
  );
};
