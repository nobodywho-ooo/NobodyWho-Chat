import React, { useCallback, useState } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useStyled } from 'hooks';

import { Chevron } from '../Chevron/Chevron';
import { Text } from '../Text/Text';

import styles from './Accordion.styles';

interface AccordionProps {
  title: string;
  initiallyExpanded?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const Accordion: React.FC<AccordionProps> = ({
  title,
  initiallyExpanded = false,
  style,
  children,
}) => {
  const { colors } = useStyled();
  const [expanded, setExpanded] = useState(initiallyExpanded);

  const toggle = useCallback(() => setExpanded(value => !value), []);

  return (
    <View style={style}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Text variant="h3" bold style={styles.title}>
          {title}
        </Text>
        <Chevron expanded={expanded} color={colors.onSurfaceVariant} />
      </Pressable>

      {expanded && children}
    </View>
  );
};
