import React from 'react';
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

  const tagView = (
    <View style={styles.tags}>
      {tags.map(tag => (
        <View
          key={tag}
          style={[styles.tag, { backgroundColor: colors.surfaceContainer }]}
        >
          <Text style={[styles.tagText, { color: colors.onSurfaceVariant }]}>
            {tag}
          </Text>
        </View>
      ))}
    </View>
  );

  let icon = (
    <PlatformIcon
      iosIconName={iosIconName}
      androidIconName={androidIconName}
      size={28}
      color={isSelected ? colors.successSurface : colors.primary}
    />
  );

  const showIcon = !isDownloaded || isSelected;

  return (
    <Pressable onPress={() => onPress?.(model)}>
      <View style={[styles.container, { borderColor: colors.border }]}>
        {showIcon && icon}
        <View
          style={showIcon ? styles.infoContainer : styles.infoContainerNoIcon}
        >
          <View style={styles.detailsContainer}>
            <Text style={styles.name} bold>
              {modelName}
            </Text>
            {!isDownloading && tagView}
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
