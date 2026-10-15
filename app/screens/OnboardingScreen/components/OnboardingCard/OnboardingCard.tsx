import React from 'react';
import { Pressable, View } from 'react-native';
import { PlatformIcon, Text } from 'components';
import { modelSizeLabel } from 'helpers';
import { useStyled } from 'hooks';

import styles from './OnboardingCard.styles';

const SIZE_ICON_SIZE = 14;

interface OnboardingCardProps {
  icon: React.ReactNode;
  title: string;
  titleDetail?: string;
  sizeGB?: number;
  tags?: React.ReactNode;
  small?: boolean;
  onPress: () => void;
  testID?: string;
}

export const OnboardingCard: React.FC<OnboardingCardProps> = ({
  icon,
  title,
  titleDetail,
  sizeGB,
  tags,
  small = false,
  onPress,
  testID,
}) => {
  const { colors } = useStyled();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [
        styles.container,
        { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon}

      <View style={styles.infoContainer}>
        <View style={styles.titleContainer}>
          <Text
            variant={small ? 'body1' : 'h4'}
            bold={!small}
            numberOfLines={1}
            style={[styles.title, small && styles.smallTitle]}
          >
            {title}
          </Text>
          {titleDetail && (
            <Text
              variant="body1"
              bold
              style={{ color: colors.onSurfaceVariant }}
            >
              {titleDetail}
            </Text>
          )}
        </View>
        {sizeGB !== undefined && sizeGB > 0 && (
          <View style={styles.sizeContainer}>
            <PlatformIcon
              iosIconName="internaldrive"
              androidIconName="hard_drive"
              size={SIZE_ICON_SIZE}
              color={colors.onSurfaceVariant}
            />
            <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
              {modelSizeLabel(sizeGB)}
            </Text>
          </View>
        )}
        {tags && <View style={styles.tagsContainer}>{tags}</View>}
      </View>

      <PlatformIcon
        iosIconName="chevron.right"
        androidIconName="chevron_right"
        size={20}
        color={colors.onSurfaceVariant}
      />
    </Pressable>
  );
};
