import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';
import {
  qwen,
  qwen4,
  bonsai,
  liquid,
  gemma4,
  supertonic,
  mistral,
  ibm,
  openai,
  silero,
  nanbeige,
  openbmb,
  ai9stars,
  tokenrhythm,
  dfm,
} from 'svg';

const familyIcons: Record<string, FC<SvgProps>> = {
  qwen4: qwen4,
  qwen: qwen,
  bonsai: bonsai,
  LFM2: liquid,
  LFM3: liquid,
  'Gemma 4': gemma4,
  'EmbeddingGemma 2': gemma4,
  supertonic: supertonic,
  ministral: mistral,
  Granite: ibm,
  Whisper: openai,
  Silero: silero,
  Nanbeige: nanbeige,
  MiniCPM5: openbmb,
  G9v3: ai9stars,
  'NeoHorse 1': tokenrhythm,
  dfm: dfm,
};

export const getFamilyIcon = (family: string): FC<SvgProps> | undefined => {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '');
  const normalized = normalize(family);
  return Object.entries(familyIcons).find(([name]) =>
    normalized.includes(normalize(name)),
  )?.[1];
};
