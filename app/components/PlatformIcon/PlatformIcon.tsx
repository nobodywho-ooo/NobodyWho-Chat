import React from 'react';
import { SymbolView } from 'expo-symbols';
import type { AndroidIconName, IosIconName } from 'types';

interface PlatformIconProps {
  iosIconName: IosIconName;
  androidIconName: AndroidIconName;
  size?: number;
  color: string;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({
  iosIconName,
  androidIconName,
  size = 20,
  color,
}) => (
  <SymbolView
    name={{ ios: iosIconName, android: androidIconName }}
    size={size}
    tintColor={color}
    style={{ width: size, height: size }}
  />
);
