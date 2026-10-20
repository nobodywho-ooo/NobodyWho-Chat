import React, { useCallback } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { MaterialSymbolProps, SFSymbolProps } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import {
  getFamilyIcon,
  getPipelineIcon,
  modelSizeLabel,
  parameterCountLabel,
} from 'helpers';
import { Model, pipelineLabel } from 'types';

import { Text, fontSizes } from '../Text/Text';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { Tag } from '../Tag/Tag';

import { ModelFeatureTags } from './ModelFeatureTags';
import styles from './ModelCard.styles';

const HEAVY_PROCESSING_SIZE_GB = 2;
const LOGO_SIZE = 28;
const ACTION_ICON_SIZE = 24;

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
  const { name, parameterCountBillions, sizeGB, pipeline, tags, family } =
    model;
  const isDownloading = downloadProgress !== undefined;
  const FamilyIcon = getFamilyIcon(family);
  const showDownloadIcon = !isDownloaded && !isSelected && !deleteMode;
  const icon = getPipelineIcon(pipeline);

  const handlePress = useCallback(() => {
    onPress?.(model);
  }, [onPress, model]);

  const downloadIosIcon: SFSymbolProps['name'] = isDownloading
    ? 'arrow.down.circle.dotted'
    : 'arrow.down.circle';
  const downloadAndroidIcon: MaterialSymbolProps['name'] = isDownloading
    ? 'downloading'
    : 'download';

  const parameterLabel = parameterCountLabel(parameterCountBillions);

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
        <View style={styles.headerContainer}>
          {FamilyIcon && (
            <View style={styles.logoContainer}>
              <FamilyIcon
                width={LOGO_SIZE}
                height={LOGO_SIZE}
                color={colors.onSurface}
              />
            </View>
          )}

          <View style={styles.headingContainer}>
            <View style={styles.nameContainer}>
              <Text
                variant="h4"
                bold
                numberOfLines={1}
                style={styles.modelContainer}
              >
                {name}
              </Text>
              {parameterLabel && (
                <Text
                  variant="body1"
                  bold
                  style={{ color: colors.onSurfaceVariant }}
                >
                  {`(${parameterLabel})`}
                </Text>
              )}
            </View>
            <View style={styles.pipelineContainer}>
              <PlatformIcon
                iosIconName={icon.iosIconName}
                androidIconName={icon.androidIconName}
                size={fontSizes.caption}
                color={colors.onSurface}
              />
              <Text
                variant="body2"
                numberOfLines={1}
                style={[
                  styles.pipelineLabel,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                {pipelineLabel[pipeline]}
              </Text>
              {isDownloading && (
                <Text
                  variant="body2"
                  style={{ color: colors.onSurfaceVariant }}
                >
                  {`${Math.round(downloadProgress * 100)}%`}
                </Text>
              )}
            </View>
          </View>

          {deleteMode && (
            <PlatformIcon
              iosIconName="trash"
              androidIconName="delete"
              size={ACTION_ICON_SIZE}
              color={colors.dangerSurface}
            />
          )}
          {!deleteMode && isSelected && (
            <PlatformIcon
              iosIconName="checkmark.circle.fill"
              androidIconName="check_circle"
              size={ACTION_ICON_SIZE}
              color={colors.successSurface}
            />
          )}
          {showDownloadIcon && (
            <PlatformIcon
              iosIconName={downloadIosIcon}
              androidIconName={downloadAndroidIcon}
              size={ACTION_ICON_SIZE}
              color={colors.primary}
            />
          )}
        </View>

        {isDownloading ? (
          <ProgressBar progress={downloadProgress} />
        ) : (
          <View style={styles.tagsContainer}>
            <Tag
              iosIconName="internaldrive"
              androidIconName="hard_drive"
              label={modelSizeLabel(sizeGB)}
            />
            <ModelFeatureTags model={model} />
            {sizeGB > HEAVY_PROCESSING_SIZE_GB && (
              <Tag
                iosIconName="cpu"
                androidIconName="memory"
                variant="warning"
                label={t('components.modelCard.heavyProcessing')}
              />
            )}
            {tags.map(tag => (
              <Tag key={tag} label={tag} />
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
};
