import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import { IconButtonIconProps, Text } from 'components';
import { useStyled } from 'hooks';

import { styles } from '../InputBar.styles';
import { createFeaturePress, FeatureButton } from './FeatureButton';
import { Card } from './GlassCard';

export type ImageAttachSource = 'photo' | 'camera';

interface AttachTrayProps {
  canAttachImage: boolean;
  canAttachAudio: boolean;
  imageSource?: ImageAttachSource;
  hasAudio: boolean;
  disabled: boolean;
  onAttachImage?: () => void;
  onAttachCamera?: () => void;
  onAttachAudio?: () => void;
  onUnavailable?: (message: string) => void;
}

// The Photo / Camera / Audio list the + opens, only one attachment at a time
export const AttachTray: React.FC<AttachTrayProps> = ({
  canAttachImage,
  canAttachAudio,
  imageSource,
  hasAudio,
  disabled,
  onAttachImage,
  onAttachCamera,
  onAttachAudio,
  onUnavailable,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const hasAttachment = imageSource !== undefined || hasAudio;
  const imageUnavailableMessage = t('components.inputBar.imageUnavailable');

  return (
    <Card
      style={[
        styles.attachOptionsList,
        isLiquidGlassSupported
          ? styles.glassCard
          : [
              styles.opaqueCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ],
      ]}
    >
      {(!hasAttachment || imageSource === 'photo') && (
        <AttachOption
          icon={{ iosIconName: 'photo', androidIconName: 'image' }}
          label={t('components.inputBar.photo')}
          accessibilityLabel={t('components.inputBar.attachImage')}
          active={imageSource === 'photo'}
          unavailable={!canAttachImage}
          unavailableMessage={imageUnavailableMessage}
          disabled={disabled}
          onPress={onAttachImage}
          onUnavailable={onUnavailable}
        />
      )}
      {(!hasAttachment || imageSource === 'camera') && (
        <AttachOption
          icon={{ iosIconName: 'camera', androidIconName: 'photo_camera' }}
          label={t('components.inputBar.camera')}
          accessibilityLabel={t('components.inputBar.attachCamera')}
          active={imageSource === 'camera'}
          unavailable={!canAttachImage}
          unavailableMessage={imageUnavailableMessage}
          disabled={disabled}
          onPress={onAttachCamera}
          onUnavailable={onUnavailable}
        />
      )}
      {(!hasAttachment || hasAudio) && (
        <AttachOption
          icon={{ iosIconName: 'waveform', androidIconName: 'music_note' }}
          label={t('components.inputBar.audio')}
          accessibilityLabel={t('components.inputBar.attachAudio')}
          active={hasAudio}
          unavailable={!canAttachAudio}
          unavailableMessage={t('components.inputBar.audioUnavailable')}
          disabled={disabled}
          onPress={onAttachAudio}
          onUnavailable={onUnavailable}
        />
      )}
    </Card>
  );
};

interface AttachOptionProps {
  icon: IconButtonIconProps;
  label: string;
  accessibilityLabel: string;
  active: boolean;
  unavailable: boolean;
  unavailableMessage: string;
  disabled: boolean;
  onPress?: () => void;
  onUnavailable?: (message: string) => void;
}

const AttachOption: React.FC<AttachOptionProps> = ({
  icon,
  label,
  accessibilityLabel,
  active,
  unavailable,
  unavailableMessage,
  disabled,
  onPress,
  onUnavailable,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const handleLabelPress = createFeaturePress({
    onPress,
    unavailable,
    unavailableMessage,
    onUnavailable,
  });

  return (
    <View style={styles.attachOption}>
      <FeatureButton
        icon={icon}
        accessibilityLabel={accessibilityLabel}
        active={active}
        unavailable={unavailable}
        unavailableMessage={unavailableMessage}
        disabled={disabled}
        onPress={onPress}
        onUnavailable={onUnavailable}
      />
      <Pressable onPress={handleLabelPress} disabled={disabled}>
        <Text
          variant="body2"
          style={[
            styles.attachLabel,
            {
              color: unavailable ? colors.onSurfaceDisabled : colors.onSurface,
            },
          ]}
        >
          {active ? t('components.inputBar.unselect') : label}
        </Text>
      </Pressable>
    </View>
  );
};
