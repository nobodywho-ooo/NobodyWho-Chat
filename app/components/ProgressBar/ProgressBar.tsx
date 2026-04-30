import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

interface ProgressBarProps {
  progress: number; // 0 to 1
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
}) => {
  const { colors } = useStyled();

  return (
    <View
      style={[styles.track, { backgroundColor: colors.surfaceContainer }]}
    >
      <View
        style={[
          styles.fill,
          { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: colors.primary },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    marginTop: Spacings.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
