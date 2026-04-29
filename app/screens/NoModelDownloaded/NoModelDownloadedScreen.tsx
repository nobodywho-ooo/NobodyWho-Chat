import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, PlatformIcon, Text } from 'components';
import { useStyled } from 'hooks';

import styles from './NoModelDownloadedScreen.styles';

export const NoModelDownloadedScreen: React.FC = () => {
  const { colors } = useStyled();
  const navigation = useNavigation();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
        },
      ]}
    >
      <PlatformIcon
        iosIconName={'cpu'}
        androidIconName={'memory'}
        size={50}
        color={colors.disable}
      />
      <Text variant="h3" style={styles.text}>
        No model available
      </Text>
      <Button title="Download a model" />
    </View>
  );
};
