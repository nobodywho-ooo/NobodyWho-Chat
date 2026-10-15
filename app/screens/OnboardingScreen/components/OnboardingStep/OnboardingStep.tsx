import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'components';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import styles from './OnboardingStep.styles';

interface OnboardingStepProps {
  header: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const OnboardingStep: React.FC<OnboardingStepProps> = ({
  header,
  title,
  subtitle,
  children,
  footer,
}) => {
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          paddingBottom: insets.bottom + Spacings.lg,
        },
      ]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Text variant="h1" style={styles.header}>
            {header}
          </Text>
        </View>
        <Text variant="h2">{title}</Text>
        <Text
          variant="body1"
          style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
        >
          {subtitle}
        </Text>
        {children}
      </ScrollView>
      {footer}
    </View>
  );
};
