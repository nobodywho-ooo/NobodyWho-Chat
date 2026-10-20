import React from 'react';
import { Text as RNText } from 'react-native';
import { colorBetween } from 'helpers';

import { Text } from '../Text/Text';

interface GradientTextProps extends Omit<
  React.ComponentProps<typeof Text>,
  'children'
> {
  children: string;
  from: string;
  to: string;
}

export const GradientText: React.FC<GradientTextProps> = ({
  children,
  from,
  to,
  ...props
}) => {
  const characters = Array.from(children);
  const lastIndex = Math.max(characters.length - 1, 1);

  return (
    <Text {...props}>
      {characters.map((character, index) => (
        <RNText
          key={index}
          style={{ color: colorBetween(from, to, index / lastIndex) }}
        >
          {character}
        </RNText>
      ))}
    </Text>
  );
};
