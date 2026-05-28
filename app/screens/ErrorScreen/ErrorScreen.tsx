import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { ErrorView, PlatformIcon } from 'components';

import styles from './ErrorScreen.styles';

interface ErrorScreenProps {
  onRetry: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ onRetry }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <PlatformIcon
        iosIconName="exclamationmark.triangle"
        androidIconName="warning"
        size={50}
        color={colors.onSurfaceDisabled}
      />
      <ErrorView message={t('common.somethingWentWrong')} onRetry={onRetry} />
    </View>
  );
};
