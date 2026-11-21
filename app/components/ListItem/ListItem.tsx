import React from 'react';
import { Pressable, PressableProps, View } from 'react-native';
import {
  type SFSymbolProps,
  type MaterialSymbolProps,
} from '@react-navigation/native';
import { useStyled } from 'hooks';
import { Text } from '../Text/Text';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';

import styles from './ListItem.styles';

interface ListItemIconProps {
  iosIconName: SFSymbolProps['name'];
  androidIconName: MaterialSymbolProps['name'];
  iconColor: string;
}

interface ListItemNoIconProps {
  iosIconName?: never;
  androidIconName?: never;
  iconColor?: never;
}

type ListItemProps = Omit<PressableProps, 'children'> & {
  title: string;
  subtitle: string;
} & (ListItemIconProps | ListItemNoIconProps);

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  iosIconName,
  androidIconName,
  iconColor,
  disabled,
  ...props
}) => {
  const { colors } = useStyled();

  return (
    <Pressable
      style={[styles.container, disabled && styles.disabled]}
      disabled={disabled}
      {...props}
    >
      {iosIconName && androidIconName && (
        <PlatformIcon
          iosIconName={iosIconName}
          androidIconName={androidIconName}
          color={iconColor}
        />
      )}
      <View style={[styles.content, iosIconName && styles.contentAfterIcon]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.chevron}>
        <PlatformIcon
          iosIconName="chevron.right"
          androidIconName="chevron_right"
          size={16}
          color={colors.onSurfaceVariant}
        />
      </View>
    </Pressable>
  );
};
