import React from 'react';
import { IconButton, IconButtonIconProps } from 'components';
import { useStyled } from 'hooks';

interface SendButtonProps {
  isStreaming: boolean;
  disabled: boolean;
  value: string;
  onSend: () => void;
  onStop: () => void;
}

export const SendButton: React.FC<SendButtonProps> = ({
  isStreaming,
  disabled,
  value,
  onSend,
  onStop,
}) => {
  const { colors } = useStyled();

  let color = colors.ctaContentPrimary;
  let backgroundColor = colors.ctaSurfacePrimary;
  let icon: IconButtonIconProps = {
    iosIconName: 'arrow.up',
    androidIconName: 'arrow_upward',
  };

  if (value === '' || disabled) {
    backgroundColor = colors.ctaSurfacePrimaryDisabled;
  }

  if (isStreaming) {
    color = colors.onSurface;
    backgroundColor = colors.surfaceContainer;
    icon = { iosIconName: 'stop', androidIconName: 'stop' };
  }

  const handlePress = () => {
    if (isStreaming) {
      onStop();
    } else {
      onSend();
    }
  };

  return (
    <IconButton
      icon={icon}
      onPress={handlePress}
      disabled={disabled}
      size={20}
      color={color}
      backgroundColor={backgroundColor}
      compact
      glassTint={isStreaming ? undefined : backgroundColor}
    />
  );
};
