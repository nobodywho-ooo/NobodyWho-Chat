import React from 'react';
import { View } from 'react-native';
import { useStyled } from 'hooks';
import { Model } from 'types';
import { Text } from '../Text/Text';

import styles from './ModelCard.styles';

interface ModelCardProps {
  model: Model;
}

export const ModelCard: React.FC<ModelCardProps> = ({ model }) => {
  const { colors } = useStyled();

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={styles.name} bold>
          {model.modelName}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[styles.meta, { color: colors.onSurfaceVariant }]}>
          {model.modelSizeGB} GB · {model.parameterCountBillions}B
        </Text>
        <View style={styles.tags}>
          {model.tags.map(tag => (
            <View
              key={tag}
              style={[styles.tag, { backgroundColor: colors.surfaceContainer }]}
            >
              <Text
                style={[styles.tagText, { color: colors.onSurfaceVariant }]}
              >
                {tag}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};
