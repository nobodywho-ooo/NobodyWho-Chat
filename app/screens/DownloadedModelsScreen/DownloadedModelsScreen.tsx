import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppState, useModels, useStyled } from 'hooks';
import { deleteModel, getDocumentPathsByModelId } from 'repositories';
import { deleteMessageDocuments, deleteModelFiles, isIOS, log } from 'helpers';
import { ModelCard, PlatformIcon, Text } from 'components';
import {
  inUseModelIdForPipeline,
  releaseSlots,
  selectModel,
  slotsHolding,
  useAiService,
} from 'services';
import { Model, ModelPipeline, ModelSlot, isChatPipeline } from 'types';

import styles from './DownloadedModelsScreen.styles';

export const DownloadedModelsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { models } = useModels();
  const appState = useAppState();
  const { chat, disposeTts, disposeStt, disposeVad, disposeChat } =
    useAiService();
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

  // Every slot's release, keyed by slot, so a new slot is a compile error here
  // rather than a model whose files are deleted while an engine still holds it.
  const disposeForSlot = useMemo<Record<ModelSlot, () => void>>(
    () => ({
      [ModelSlot.chat]: disposeChat,
      [ModelSlot.tts]: disposeTts,
      [ModelSlot.stt]: disposeStt,
      [ModelSlot.vad]: disposeVad,
    }),
    [disposeChat, disposeTts, disposeStt, disposeVad],
  );

  const handleDeleteModel = useCallback(
    async (model: Model) => {
      try {
        const documentPaths = await getDocumentPathsByModelId(model.id);

        // Release the engines before the files go away, so nothing is mid-read
        // when the directory is removed.
        const held = slotsHolding(model.id, appState);
        held.forEach(slot => disposeForSlot[slot]());
        await releaseSlots(held.filter(slot => slot !== ModelSlot.chat));

        const filesDeleted = await deleteModelFiles(model);
        if (!filesDeleted) {
          throw new Error('files not deleted');
        }

        await deleteModel(model.id);

        // The chat slot is cleared last: dropping it also drops the open
        // conversation, which routes the UI away from this screen. Nothing may
        // sit between the row delete and this release — a throw in between
        // strands modelIdInUse pointing at a model that no longer exists for
        // the rest of the session (app state is a separate store, so the
        // ON DELETE CASCADE can't clear it and only dropStaleIdsInUse at the
        // next launch would).
        await releaseSlots(held.filter(slot => slot === ModelSlot.chat));

        // Best-effort orphan cleanup, so a failure here can't strand the slot.
        await deleteMessageDocuments(documentPaths);
      } catch (error) {
        log('DownloadedModelsScreen handleDeleteModel', error);
      }
    },
    [appState, disposeForSlot],
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

      if (inUseModelIdForPipeline(model.pipeline, appState) === model.id) {
        return;
      }

      // Stop any in-flight generation before the model switch tears down the
      // current chat, so a live stream ends cleanly rather than being cut off
      // mid-token as the backend is swapped out.
      if (isChatPipeline(model.pipeline)) {
        chat.current?.stopGeneration();
      }

      selectModel(model);
    },
    [deleteMode, confirmDeleteModel, appState, chat],
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

  const inUseIdFor = (pipeline: ModelPipeline) =>
    inUseModelIdForPipeline(pipeline, appState);

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
