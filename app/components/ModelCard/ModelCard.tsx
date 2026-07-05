import React, { useCallback } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { getFamilyIcon } from 'helpers';
import { Model, ModelPipeline, pipelineLabel } from 'types';
import { Text, fontSizes } from '../Text/Text';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { Tag } from '../Tag/Tag';

import styles from './ModelCard.styles';
import { MaterialSymbolProps, SFSymbolProps } from '@react-navigation/native';

const HIGH_CPU_USAGE_SIZE_GB = 2;

const pipelineIcon: Record<
  ModelPipeline,
  {
    iosIconName: SFSymbolProps['name'];
    androidIconName: MaterialSymbolProps['name'];
  }
> = {
  [ModelPipeline.textGeneration]: {
    iosIconName: 'text.bubble',
    androidIconName: 'chat',
  },
  [ModelPipeline.imageToImage]: {
    iosIconName: 'photo',
    androidIconName: 'image',
  },
  [ModelPipeline.imageTextToText]: {
    iosIconName: 'photo.on.rectangle',
    androidIconName: 'photo_library',
  },
  [ModelPipeline.audioTextToText]: {
    iosIconName: 'waveform',
    androidIconName: 'graphic_eq',
  },
  [ModelPipeline.imageAudioTextToText]: {
    iosIconName: 'square.grid.2x2',
    androidIconName: 'dashboard',
  },
  [ModelPipeline.featureExtraction]: {
    iosIconName: 'magnifyingglass',
    androidIconName: 'search',
  },
  [ModelPipeline.textRanking]: {
    iosIconName: 'list.number',
    androidIconName: 'format_list_numbered',
  },
  [ModelPipeline.textToSpeech]: {
    iosIconName: 'speaker.wave.2',
    androidIconName: 'text_to_speech',
  },
  // TODO: update icons
  [ModelPipeline.speechToText]: {
    iosIconName: 'speaker.wave.2',
    androidIconName: 'text_to_speech',
  },
  // TODO: update icons
  [ModelPipeline.automaticSpeechRecognition]: {
    iosIconName: 'speaker.wave.2',
    androidIconName: 'text_to_speech',
  },
};

interface ModelCardProps {
  style?: StyleProp<ViewStyle>;
  isSelected?: boolean;
  isDownloaded?: boolean;
  deleteMode?: boolean;
  model: Model;
  downloadProgress?: number;
  onPress?: (model: Model) => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  style,
  isSelected,
  isDownloaded,
  deleteMode,
  model,
  downloadProgress,
  onPress,
}) => {
  const { colors } = useStyled();
  const { t } = useTranslation();
  const {
    name,
    parameterCountBillions,
    sizeGB,
    pipeline,
    tags,
    family,
    thinking,
    languages,
  } = model;
  const isDownloading = downloadProgress !== undefined;

  const FamilyIcon = getFamilyIcon(family);
  const showDownloadIcon = !isDownloaded && !isSelected && !deleteMode;

  const handlePress = useCallback(() => {
    onPress?.(model);
  }, [onPress, model]);

  const downloadIosIcon: SFSymbolProps['name'] = isDownloading
    ? 'arrow.down.circle.dotted'
    : 'arrow.down.circle';
  const downloadAndroidIcon: MaterialSymbolProps['name'] = isDownloading
    ? 'downloading'
    : 'download';

  const parameterCountLabel =
    parameterCountBillions >= 1
      ? `(${parameterCountBillions}B)`
      : `(${Math.round(parameterCountBillions * 1000)}M)`;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, style]}
    >
      <View
        style={[
          styles.container,
          { borderColor: isSelected ? colors.onSurfaceVariant : colors.border },
        ]}
      >
        {FamilyIcon && (
          <FamilyIcon width={28} height={28} color={colors.onSurface} />
        )}

        <View style={styles.infoContainer}>
          <View style={styles.nameContainer}>
            <Text
              variant="h4"
              bold
              numberOfLines={1}
              style={styles.modelContainer}
            >
              {name}
            </Text>
            <Text
              variant="body1"
              bold
              style={{ color: colors.onSurfaceVariant }}
            >
              {parameterCountLabel}
            </Text>
          </View>
          <View style={styles.pipelineContainer}>
            <PlatformIcon
              iosIconName={pipelineIcon[pipeline].iosIconName}
              androidIconName={pipelineIcon[pipeline].androidIconName}
              size={fontSizes.caption}
              color={colors.onSurface}
            />
            <Text
              variant="body2"
              numberOfLines={1}
              style={[styles.pipelineLabel, { color: colors.onSurfaceVariant }]}
            >
              {pipelineLabel[pipeline]}
            </Text>
            {isDownloading && (
              <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
                {`${Math.round(downloadProgress * 100)}%`}
              </Text>
            )}
          </View>

          {isDownloading ? (
            <ProgressBar progress={downloadProgress} />
          ) : (
            <View style={styles.tagsContainer}>
              <Tag
                iosIconName="internaldrive"
                androidIconName="hard_drive"
                label={`${sizeGB} GB`}
              />
              {languages.length > 0 && (
                <Tag
                  iosIconName="globe"
                  androidIconName="language"
                  label={t('components.modelCard.languageCount', {
                    count: languages.length,
                  })}
                />
              )}
              {thinking && (
                <Tag
                  iosIconName="lightbulb"
                  androidIconName="lightbulb"
                  label="Thinking"
                />
              )}
              {sizeGB > HIGH_CPU_USAGE_SIZE_GB && (
                <Tag
                  iosIconName="cpu"
                  androidIconName="memory"
                  label="High CPU usage"
                />
              )}
              {tags.map(tag => (
                <Tag key={tag} label={tag} />
              ))}
            </View>
          )}
        </View>

        {deleteMode && (
          <PlatformIcon
            iosIconName="trash"
            androidIconName="delete"
            size={24}
            color={colors.dangerSurface}
          />
        )}
        {!deleteMode && isSelected && (
          <PlatformIcon
            iosIconName="checkmark.circle.fill"
            androidIconName="check_circle"
            size={24}
            color={colors.successSurface}
          />
        )}
        {showDownloadIcon && (
          <PlatformIcon
            iosIconName={downloadIosIcon}
            androidIconName={downloadAndroidIcon}
            size={28}
            color={colors.primary}
          />
        )}
      </View>
    </Pressable>
  );
};
