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
  size?: number;
  color: string;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({
  iosIconName,
  androidIconName,
  size = 20,
  color,
}) => {
  const style = { width: size, height: size };

  if (isIOS) {
    return (
      <SFSymbol name={iosIconName} size={size} color={color} style={style} />
    );
  }
  return (
    <MaterialSymbol
      name={androidIconName}
      size={size}
      color={color}
      style={style}
    />
  );
};
