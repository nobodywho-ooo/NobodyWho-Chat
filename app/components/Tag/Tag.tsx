import React from 'react';
import { View } from 'react-native';
import { MaterialSymbolProps, SFSymbolProps } from '@react-navigation/native';
import { useStyled } from 'hooks';
import { Text } from '../Text/Text';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';

import styles from './Tag.styles';

interface TagProps {
  label: string;
  iosIconName?: SFSymbolProps['name'];
  androidIconName?: MaterialSymbolProps['name'];
}

export const Tag: React.FC<TagProps> = ({
  label,
  iosIconName,
  androidIconName,
}) => {
  const { colors } = useStyled();

  const textColor =
    label === 'Recommended'
      ? colors.ctaContentPrimary
      : colors.onSurfaceVariant;
  const backgroundColor =
    label === 'Recommended'
      ? colors.ctaSurfacePrimary
      : colors.surfaceContainer;

  return (
    <View style={[styles.container, { backgroundColor: backgroundColor }]}>
      {iosIconName && androidIconName && (
        <PlatformIcon
          iosIconName={iosIconName}
          androidIconName={androidIconName}
          size={12}
          color={colors.onSurfaceVariant}
        />
      )}
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
};
