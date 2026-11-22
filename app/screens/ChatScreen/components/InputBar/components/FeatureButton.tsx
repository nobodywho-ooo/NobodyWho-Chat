import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { IconButton, IconButtonIconProps } from 'components';
import { haptics } from 'helpers';
import { useStyled } from 'hooks';

interface FeaturePressOptions {
  onPress?: () => void;
  unavailable?: boolean;
  unavailableMessage?: string;
  onUnavailable?: (message: string) => void;
}

export const createFeaturePress = ({
  onPress,
  unavailable = false,
  unavailableMessage,
  onUnavailable,
}: FeaturePressOptions) => {
  return () => {
    if (!unavailable) {
      onPress?.();
      return;
    }

    haptics.light();

    if (unavailableMessage) {
      onUnavailable?.(unavailableMessage);
    }
  };
};

interface FeatureButtonProps extends FeaturePressOptions {
  icon: IconButtonIconProps;
  accessibilityLabel: string;
  active?: boolean;
  activeTone?: 'primary' | 'danger';
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export const FeatureButton: React.FC<FeatureButtonProps> = ({
  icon,
  accessibilityLabel,
  active = false,
  activeTone = 'primary',
  selected,
  disabled = false,
  testID,
  style,
  ...pressOptions
}) => {
  const { colors } = useStyled();
  const handlePress = createFeaturePress(pressOptions);
  const unavailable = pressOptions.unavailable ?? false;

  const activeColors =
    activeTone === 'danger'
      ? { content: colors.dangerContent, surface: colors.dangerSurface }
      : {
          content: colors.ctaContentPrimary,
          surface: colors.ctaSurfacePrimary,
        };

  const greyedOut = unavailable || disabled;
  const highlighted = active && !greyedOut;

  let color = colors.onSurface;

  if (greyedOut) {
    color = colors.onSurfaceDisabled;
  } else if (highlighted) {
    color = activeColors.content;
  }

  return (
    <IconButton
      icon={icon}
      onPress={handlePress}
      disabled={disabled}
      size={20}
      color={color}
      backgroundColor={
        highlighted ? activeColors.surface : colors.surfaceContainer
      }
      compact
      glassTint={highlighted ? activeColors.surface : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        disabled: unavailable || disabled,
        ...(selected !== undefined && { selected: selected && !unavailable }),
      }}
      testID={testID}
      style={style}
    />
  );
};
