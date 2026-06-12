import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';
import { qwen, bonsai, liquid, gemma4} from 'svg';

const familyIcons: Record<string, FC<SvgProps>> = {
  qwen: qwen,
  bonsai: bonsai,
  LFM2: liquid,
  "Gemma 4": gemma4,
};

export const getFamilyIcon = (family: string): FC<SvgProps> | undefined => {
  const normalized = family.toLowerCase();
  return Object.entries(familyIcons).find(([name]) =>
    normalized.includes(name.toLowerCase()),
  )?.[1];
};
