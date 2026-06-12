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

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surfaceContainer }]}
    >
      {iosIconName && androidIconName && (
        <PlatformIcon
          iosIconName={iosIconName}
          androidIconName={androidIconName}
          size={12}
          color={colors.onSurfaceVariant}
        />
      )}
      <Text style={[styles.text, { color: colors.onSurfaceVariant }]}>
        {label}
      </Text>
    </View>
  );
};
