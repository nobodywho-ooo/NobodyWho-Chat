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

interface ListItemProps extends Omit<PressableProps, 'children'> {
  title: string;
  subtitle: string;
  iosIconName: SFSymbolProps['name'];
  androidIconName: MaterialSymbolProps['name'];
  iconBackgroundColor: string;
}

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  iosIconName,
  androidIconName,
  iconBackgroundColor,
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
      <View
        style={[styles.iconContainer, { backgroundColor: iconBackgroundColor }]}
      >
        <PlatformIcon
          iosIconName={iosIconName}
          androidIconName={androidIconName}
          size={20}
          color="#FFFFFF"
        />
      </View>
      <View style={styles.content}>
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
