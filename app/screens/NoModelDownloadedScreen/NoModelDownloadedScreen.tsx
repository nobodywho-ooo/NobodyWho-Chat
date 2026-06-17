import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, Text } from 'components';
import { useStyled } from 'hooks';

import styles from './NoModelDownloadedScreen.styles';

export const NoModelDownloadedScreen: React.FC = () => {
  const { t } = useTranslation();
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
        iosIconName="square.stack.3d.up.fill"
        androidIconName="layers"
        size={50}
        color={colors.onSurfaceDisabled}
      />
      <Text variant="h3" style={styles.text}>
        {t('screens.noModelDownloaded.noModelAvailable')}
      </Text>
      <Button
        title={t('screens.noModelDownloaded.downloadModel')}
        onPress={() => {
          // @ts-ignore
          navigation.navigate('ModelsScreen');
        }}
      />
    </View>
  );
};
