import React from 'react';
import { View } from 'react-native';
import { MaterialSymbolProps, SFSymbolProps } from '@react-navigation/native';
import { useStyled } from 'hooks';
import { Text } from '../Text/Text';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';

import styles from './Tag.styles';

export type TagVariant = 'default' | 'highlight' | 'warning';

const CATALOGUE_HIGHLIGHT_LABEL = 'Great First Pick';

interface TagProps {
  label: string;
  variant?: TagVariant;
  iosIconName?: SFSymbolProps['name'];
  androidIconName?: MaterialSymbolProps['name'];
}

export const Tag: React.FC<TagProps> = ({
  label,
  variant,
  iosIconName,
  androidIconName,
}) => {
  const { colors } = useStyled();

  const resolvedVariant: TagVariant =
    variant ?? (label === CATALOGUE_HIGHLIGHT_LABEL ? 'highlight' : 'default');

  const { textColor, backgroundColor } = {
    default: {
      textColor: colors.onSurfaceVariant,
      backgroundColor: colors.surfaceSecondary,
    },
    highlight: {
      textColor: colors.onSurface,
      backgroundColor: colors.surfaceContainer,
    },
    warning: {
      textColor: colors.warningContent,
      backgroundColor: colors.warningSurface,
    },
  }[resolvedVariant];

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
