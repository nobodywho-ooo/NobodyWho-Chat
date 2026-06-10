import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, Text } from 'components';
import { useStyled } from 'hooks';

import styles from './NoModelSelectedScreen.styles';

export const NoModelSelectedScreen: React.FC = () => {
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
          // @ts-ignore
          navigation.navigate('ModelsScreen');
        }}
      />
    </View>
  );
};
