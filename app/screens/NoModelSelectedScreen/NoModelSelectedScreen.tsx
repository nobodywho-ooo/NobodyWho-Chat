import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, Text } from 'components';
import { useStyled } from 'hooks';
import { Routes } from 'navigation';

import styles from './NoModelSelectedScreen.styles';

export const NoModelSelectedScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();

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
        color={colors.onSurfaceDisabled}
      />
      <Text variant="h3" style={styles.text}>
        {t('screens.noModelSelected.pleaseSelectAModel')}
      </Text>
      <Button
        title={t('screens.noModelSelected.selectModel')}
        onPress={() => {
          router.navigate(Routes.models);
        }}
      />
    </View>
  );
};
