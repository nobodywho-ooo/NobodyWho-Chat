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

  let textColor = colors.onSurfaceVariant;
  let backgroundColor = colors.surfaceSecondary;

  if (label === 'Great First Pick') {
    textColor = colors.onSurface;
    backgroundColor = colors.surfaceContainer;
  } else if (label === 'High CPU usage') {
    textColor = colors.warningContent;
    backgroundColor = colors.warningSurface;
  }

  return (
    <View style={[styles.container, { backgroundColor: backgroundColor }]}>
      {iosIconName && androidIconName && (
        <PlatformIcon
          iosIconName={iosIconName}
          androidIconName={androidIconName}
          size={12}
          color={textColor}
        />
      )}
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
};
