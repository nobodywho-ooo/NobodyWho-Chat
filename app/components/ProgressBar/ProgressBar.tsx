import React from 'react';
import { View } from 'react-native';
import { useStyled } from 'hooks';

import styles from './ProgressBar.styles';

interface ProgressBarProps {
  progress: number; // 0 to 1
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const { colors } = useStyled();
  const width = `${Math.min(progress, 1) * 100}%`;

  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceContainer }]}>
      <View
        style={[
          styles.fill,
          {
            width,
            backgroundColor: colors.primary,
          },
        ]}
      />
    </View>
  );
};
