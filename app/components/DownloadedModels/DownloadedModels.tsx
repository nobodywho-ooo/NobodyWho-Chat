import React, { useCallback } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppState, useModels, useStyled } from 'hooks';
import { deleteModel, getDocumentPathsByModelId } from 'repositories';
import { deleteMessageDocuments, deleteModelFiles, log } from 'helpers';
import {
  inUseModelIdForPipeline,
  releaseSlots,
  selectModel,
  slotsHolding,
  useAiService,
} from 'services';
import {
  Model,
  ModelPipeline,
  ModelSlot,
  isChatPipeline,
  pipelineLabel,
} from 'types';

import { ModelCard } from '../ModelCard/ModelCard';
import { Text } from '../Text/Text';

import styles from './DownloadedModels.styles';

const sectionPipeline = (pipeline: ModelPipeline): ModelPipeline =>
  isChatPipeline(pipeline) ? ModelPipeline.textGeneration : pipeline;

const VOICE_PIPELINES: readonly ModelPipeline[] = [
  ModelPipeline.textToSpeech,
  ModelPipeline.speechToText,
  ModelPipeline.voiceActivityDetection,
];

const SECTION_ORDER: readonly ModelPipeline[] = [
  ModelPipeline.textGeneration,
  ...VOICE_PIPELINES,
  ...Object.values(ModelPipeline).filter(
    pipeline =>
      !isChatPipeline(pipeline) && !VOICE_PIPELINES.includes(pipeline),
  ),
];

interface ModelSection {
  pipeline: ModelPipeline;
  models: Model[];
}

const toSections = (models: readonly Model[]): ModelSection[] =>
  SECTION_ORDER.flatMap(pipeline => {
    const sectionModels = models.filter(
      model => sectionPipeline(model.pipeline) === pipeline,
    );

    return sectionModels.length > 0
      ? [{ pipeline, models: sectionModels }]
      : [];
  });

interface DownloadedModelsProps {
  deleteMode: boolean;
}

export const DownloadedModels: React.FC<DownloadedModelsProps> = ({
  deleteMode,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { models } = useModels();
  const appState = useAppState();
  const { slots } = useAiService();

  const handleDeleteModel = useCallback(
    async (model: Model) => {
      try {
        const documentPaths = await getDocumentPathsByModelId(model.id);

        // Release the engines before the files go away, so nothing is mid-read
        // when the directory is removed.
        const held = slotsHolding(model.id, appState);
        held.forEach(slot => slots[slot].dispose());
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
        log('DownloadedModels handleDeleteModel', error);
      }
    },
    [appState, slots],
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
        slots.chat.ref.current?.stopGeneration();
      }

      selectModel(model);
    },
    [deleteMode, confirmDeleteModel, appState, slots],
  );

  const inUseIdFor = (pipeline: ModelPipeline) =>
    inUseModelIdForPipeline(pipeline, appState);

  return (
    <>
      {toSections(models).map(section => (
        <View key={section.pipeline} style={styles.sectionContainer}>
          <Text
            variant="body2"
            bold
            style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}
          >
            {pipelineLabel[section.pipeline]}
          </Text>
          {section.models.map(model => (
            <ModelCard
              key={model.id}
              isDownloaded
              deleteMode={deleteMode}
              isSelected={inUseIdFor(model.pipeline) === model.id}
              model={model}
              onPress={handleModelPress}
            />
          ))}
        </View>
      ))}
    </>
  );
};
