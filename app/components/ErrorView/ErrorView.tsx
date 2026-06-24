import React from 'react';
import { ViewStyle, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Spacings } from 'style';
import { Button } from '../Button/Button';
import { Text } from '../Text/Text';

import styles from './ErrorView.styles';

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
  paddingVertical?: number;
  alignLeft?: boolean;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  message,
  onRetry,
  paddingVertical = Spacings.xxl,
  alignLeft = false,
}) => {
  const { t } = useTranslation();
  const alignment: ViewStyle = {
    alignItems: alignLeft ? 'flex-start' : 'center',
  };
  const padding: ViewStyle = {
    paddingVertical: paddingVertical,
  };

  return (
    <View style={[padding, alignment]}>
      <Text style={styles.text}>{message}</Text>
      <Button
        icon={{
          iosIconName: 'arrow.clockwise',
          androidIconName: 'refresh',
        }}
        title={t('common.retry')}
        onPress={onRetry}
      />
    </View>
  );
};
