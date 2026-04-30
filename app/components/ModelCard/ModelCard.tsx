import React from 'react';
import { Pressable, View } from 'react-native';
import { useStyled } from 'hooks';
import { Model, pipelineLabel } from 'types';
import { Text } from '../Text/Text';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { ProgressBar } from '../ProgressBar/ProgressBar';

import styles from './ModelCard.styles';

interface ModelCardProps {
  model: Model;
  downloadProgress?: number;
  onPress?: (model: Model) => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  downloadProgress,
  onPress,
}) => {
  const { colors } = useStyled();
  const { modelName, parameterCountBillions, modelSizeGB, pipeline, tags } =
    model;
  const isDownloading = downloadProgress !== undefined;

  const iosIconName = isDownloading
    ? 'arrow.down.circle.dotted'
    : 'arrow.down.circle';
  const androidIconName = isDownloading ? 'downloading' : 'download';

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

  return (
    <Pressable onPress={() => onPress?.(model)}>
      <View style={[styles.container, { borderColor: colors.border }]}>
        <PlatformIcon
          iosIconName={iosIconName}
          androidIconName={androidIconName}
          size={28}
          color={colors.primary}
        />
        <View style={styles.infoContainer}>
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
