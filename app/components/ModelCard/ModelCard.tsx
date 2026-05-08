import React, { useCallback } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useStyled } from 'hooks';
import { Model, pipelineLabel } from 'types';
import { Text } from '../Text/Text';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { ProgressBar } from '../ProgressBar/ProgressBar';

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
  const { modelName, parameterCountBillions, modelSizeGB, pipeline, tags } =
    model;
  const isDownloading = downloadProgress !== undefined;
  const showIcon = !isDownloaded || isSelected;

  const handlePress = useCallback(() => {
    onPress?.(model);
  }, [onPress, model]);

  let iosIconName: SFSymbolProps['name'] = isDownloading
    ? 'arrow.down.circle.dotted'
    : 'arrow.down.circle';
  let androidIconName: MaterialSymbolProps['name'] = isDownloading
    ? 'downloading'
    : 'download';

  if (isSelected) {
    iosIconName = 'checkmark.circle';
    androidIconName = 'check_circle';
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={modelName}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, style]}
    >
      <View style={[styles.container, { borderColor: colors.border }]}>
        {showIcon && (
          <PlatformIcon
            iosIconName={iosIconName}
            androidIconName={androidIconName}
            size={28}
            color={isSelected ? colors.successSurface : colors.primary}
          />
        )}
        <View
          style={showIcon ? styles.infoContainer : styles.infoContainerNoIcon}
        >
          <View style={styles.detailsContainer}>
            <Text style={styles.name} bold>
              {modelName}
            </Text>
            {!isDownloading && (
              <View style={styles.tags}>
                {tags.map(tag => (
                  <View
                    key={tag}
                    style={[
                      styles.tag,
                      { backgroundColor: colors.surfaceContainer },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {isDownloading ? (
            <ProgressBar progress={downloadProgress} />
          ) : (
            <Text style={[styles.metaData, { color: colors.onSurfaceVariant }]}>
              {pipelineLabel[pipeline]} · {parameterCountBillions}B ·{' '}
              {modelSizeGB} GB
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};
