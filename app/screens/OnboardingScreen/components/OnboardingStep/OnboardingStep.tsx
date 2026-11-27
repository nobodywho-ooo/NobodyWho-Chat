import React from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'components';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import { ONBOARDING_PADDING_HORIZONTAL } from '../../Onboarding.styles';
import styles from './OnboardingStep.styles';

interface OnboardingStepProps {
  header: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  background?: React.ReactNode;
}

export const OnboardingStep: React.FC<OnboardingStepProps> = ({
  header,
  title,
  subtitle,
  children,
  footer,
  background,
}) => {
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const bottomSpacing = width > height ? Spacings.lg : Spacings.xxxl;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          paddingLeft: insets.left + ONBOARDING_PADDING_HORIZONTAL,
          paddingRight: insets.right + ONBOARDING_PADDING_HORIZONTAL,
        },
      ]}
    >
      {background}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + bottomSpacing },
        ]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View style={styles.content}>
          <View style={styles.headerContainer}>
            <Text variant="h1" style={styles.header}>
              {header}
            </Text>
          </View>
          <View>
            <Text variant="h2">{title}</Text>
            <Text
              variant="body1"
              style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
            >
              {subtitle}
            </Text>
          </View>
          {children}
          {footer}
        </View>
      </ScrollView>
    </View>
  );
};
