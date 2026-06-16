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
};

interface ModelCardProps {
  style?: StyleProp<ViewStyle>;
  isSelected?: boolean;
  isDownloaded?: boolean;
  model: Model;
  downloadProgress?: number;
  onPress?: (model: Model) => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  style,
  isSelected,
  isDownloaded,
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
  const showDownloadIcon = !isDownloaded && !isSelected;

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
              color={colors.onSurfaceVariant}
            />
            <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
              {pipelineLabel[pipeline]}
            </Text>
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
              {tags.map(tag => (
                <Tag key={tag} label={tag} />
              ))}
            </View>
          )}
        </View>

        {isSelected && (
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
