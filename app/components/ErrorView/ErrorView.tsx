import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';
import { Text } from '../Text/Text';

import styles from './ErrorView.styles';

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({ message, onRetry }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      <Button title={t('common.retry')} onPress={onRetry} />
    </View>
  );
};
