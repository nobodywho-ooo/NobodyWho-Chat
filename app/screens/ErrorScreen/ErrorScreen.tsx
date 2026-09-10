import React from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { Button, ErrorView, PlatformIcon } from 'components';

import styles from './ErrorScreen.styles';

interface ErrorScreenProps {
  onRetry: () => void;
  onReset?: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  onRetry,
  onReset,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const confirmReset = () => {
    if (!onReset) return;
    Alert.alert(
      t('screens.errorScreen.resetConfirmTitle'),
      t('screens.errorScreen.resetConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('screens.errorScreen.resetConfirm'),
          style: 'destructive',
          onPress: onReset,
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <PlatformIcon
        iosIconName="exclamationmark.triangle"
        androidIconName="warning"
        size={50}
        color={colors.onSurfaceDisabled}
      />
      <ErrorView message={t('common.somethingWentWrong')} onRetry={onRetry} />
      {onReset && (
        <Button
          testID="error-reset-button"
          variant="outline"
          title={t('screens.errorScreen.resetData')}
          onPress={confirmReset}
        />
      )}
    </View>
  );
};
