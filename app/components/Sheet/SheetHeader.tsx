import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useStyled } from 'hooks';

import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { Text } from '../Text/Text';

import styles from './SheetHeader.styles';

interface SheetHeaderProps {
  title: string;
  onClose: () => void;
  closeLabel: string;
  closeTestID?: string;
}

const CLOSE_ICON_SIZE = 22;

interface SheetCloseIconProps {
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

// A sheet's plain close icon, without the glass button behind it, for a Sheet
// with showCloseButton={false}.
export const SheetCloseIcon: React.FC<SheetCloseIconProps> = ({
  onPress,
  accessibilityLabel,
  testID,
  style,
}) => {
  const { colors } = useStyled();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      <PlatformIcon
        iosIconName="xmark"
        androidIconName="close"
        size={CLOSE_ICON_SIZE}
        color={colors.onSurface}
      />
    </Pressable>
  );
};

export const SheetHeader: React.FC<SheetHeaderProps> = ({
  title,
  onClose,
  closeLabel,
  closeTestID,
}) => (
  <View style={styles.row}>
    <Text variant="h3" bold style={styles.title}>
      {title}
    </Text>
    <SheetCloseIcon
      onPress={onClose}
      accessibilityLabel={closeLabel}
      testID={closeTestID}
    />
  </View>
);
