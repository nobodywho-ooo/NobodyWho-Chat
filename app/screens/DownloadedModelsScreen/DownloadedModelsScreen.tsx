import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStyled } from 'hooks';
import { filter, includes } from 'ramda';
import { Button, ModelCard, Text } from 'components';
import { Model, ModelPipeline } from 'types';

import styles from './DownloadedModelsScreen.styles';

export const DownloadedModelsScreen: React.FC = () => {
  const { colors } = useStyled();
  const [currentModel, setCurrentModel] = useState<Model | undefined>();
  const [models, setModels] = useState<Model[]>([]);
  const navigation = useNavigation();

  useEffect(() => {
    // WIP: fake model for now
    let model: Model = {
      id: 1,
      modelName: 'Qwen3 4B Q4 K M',
      modelSizeGB: 2.5,
      parameterCountBillions: 4,
      author: 'Qwen',
      family: 'Qwen3',
      downloadLinks: [
        {
          url: 'https://huggingface.co/NobodyWho/Qwen_Qwen3-0.6B-GGUF/resolve/main/Qwen_Qwen3-0.6B-Q4_K_M.gguf',
          fileName: 'Qwen_Qwen3-0.6B-Q4_K_M.gguf',
          type: 'model',
        },
      ],
      pipeline: ModelPipeline.textGeneration,
      tags: ['Fast'],
    };
    setCurrentModel(model);

    let models: Model[] = [
      {
        id: 1,
        modelName: 'Qwen3 4B Q4 K M',
        modelSizeGB: 2.5,
        parameterCountBillions: 4,
        author: 'Qwen',
        family: 'Qwen3',
        downloadLinks: [
          {
            url: 'https://huggingface.co/NobodyWho/Qwen_Qwen3-0.6B-GGUF/resolve/main/Qwen_Qwen3-0.6B-Q4_K_M.gguf',
            fileName: 'Qwen_Qwen3-0.6B-Q4_K_M.gguf',
            type: 'model',
          },
        ],
        pipeline: ModelPipeline.textGeneration,
        tags: ['Fast'],
      },
      {
        id: 2,
        modelName: 'Qwen3 0.6B Q4 K M',
        modelSizeGB: 0.4,
        parameterCountBillions: 4,
        author: 'Qwen',
        family: 'Qwen3',
        downloadLinks: [
          {
            url: 'https://huggingface.co/NobodyWho/Qwen_Qwen3-0.6B-GGUF/resolve/main/Qwen_Qwen3-0.6B-Q4_K_M.gguf',
            fileName: 'Qwen_Qwen3-0.6B-Q4_K_M.gguf',
            type: 'model',
          },
        ],
        pipeline: ModelPipeline.textGeneration,
        tags: ['Fast'],
      },
      {
        id: 3,
        modelName: 'LFM2 700M Q3 K M',
        modelSizeGB: 0.4,
        parameterCountBillions: 0.7,
        author: 'Liquid AI',
        family: 'LFM2',
        downloadLinks: [
          {
            url: 'https://huggingface.co/unsloth/LFM2-700M-GGUF/resolve/main/LFM2-700M-Q3_K_M.gguf',
            fileName: 'LFM2-700M-Q3_K_M.gguf',
            type: 'model',
          },
        ],
        pipeline: ModelPipeline.textGeneration,
        tags: ['Tiny'],
      },
      {
        id: 4,
        modelName: 'Gemma 4 E2B it',
        modelSizeGB: 3.4,
        parameterCountBillions: 5,
        author: 'Google',
        family: 'Gemma 4',
        downloadLinks: [
          {
            url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q3_K_S.gguf',
            fileName: 'gemma-4-E2B-it-Q3_K_S.gguf',
            type: 'model',
          },
          {
            url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/mmproj-BF16.gguf',
            fileName: 'mmproj-BF16.gguf',
            type: 'projection',
          },
        ],
        pipeline: ModelPipeline.imageAudioTextToText,
        tags: ['Powerful'],
      },
    ];
    setModels(models);
  }, []);

  const handleModelPress = useCallback((model: Model) => {
    console.log('Model pressed:', model);
    // Unload current model
    // load new model
  }, []);

  if (models.length == 0) {
    return (
      <View style={styles.noModelContainer}>
        <Text variant="h4" style={styles.noModelContainerText}>
          No model downloaded
        </Text>
        <Button title="Download a model" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      {models.map(model => {
        let isSelected = false;
        if (!!currentModel) {
          isSelected = currentModel.id == model.id;
        }

        return (
          <ModelCard
            key={model.id}
            isDownloaded
            isSelected={isSelected}
            model={model}
            onPress={handleModelPress}
          />
        );
      })}
    </ScrollView>
  );
};
