import React from 'react';
import {
  SFSymbol,
  MaterialSymbol,
  type SFSymbolProps,
  type MaterialSymbolProps,
} from '@react-navigation/native';
import { isIOS } from 'helpers';

interface PlatformIconProps {
  iosIconName: SFSymbolProps['name'];
  androidIconName: MaterialSymbolProps['name'];
  size: number;
  color: string;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({
  iosIconName,
  androidIconName,
  size,
  color,
}) => {
  if (isIOS) {
    return <SFSymbol name={iosIconName} size={size} color={color} />;
  }
  return <MaterialSymbol name={androidIconName} size={size} color={color} />;
};
