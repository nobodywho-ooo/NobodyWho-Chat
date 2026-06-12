import React, { useCallback } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useStyled } from 'hooks';
import { getFamilyIcon } from 'helpers';
import { Model, pipelineLabel } from 'types';
import { Text } from '../Text/Text';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { Tag } from '../Tag/Tag';

import styles from './ModelCard.styles';
import { MaterialSymbolProps, SFSymbolProps } from '@react-navigation/native';

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
  const {
    modelName,
    parameterCountBillions,
    modelSizeGB,
    pipeline,
    tags,
    family,
    thinking,
  } = model;
  const isDownloading = downloadProgress !== undefined;

  const FamilyIcon = isSelected ? undefined : getFamilyIcon(family);
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

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={modelName}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, style]}
    >
      <View style={[styles.container, { borderColor: colors.border }]}>
        {isSelected && (
          <PlatformIcon
            iosIconName="checkmark.circle"
            androidIconName="check_circle"
            size={28}
            color={colors.successSurface}
          />
        )}
        {FamilyIcon && (
          <FamilyIcon width={28} height={28} color={colors.onSurface} />
        )}

        <View style={styles.infoContainer}>
          <Text bold>{modelName}</Text>
          <Text style={[styles.pipeline, { color: colors.onSurfaceVariant }]}>
            {pipelineLabel[pipeline]}
          </Text>

          {isDownloading ? (
            <ProgressBar progress={downloadProgress} />
          ) : (
            <View style={styles.tagsContainer}>
              <Tag
                iosIconName="square.stack.3d.up.fill"
                androidIconName="layers"
                label={`${parameterCountBillions}B`}
              />
              <Tag
                iosIconName="internaldrive"
                androidIconName="storage"
                label={`${modelSizeGB} GB`}
              />
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
