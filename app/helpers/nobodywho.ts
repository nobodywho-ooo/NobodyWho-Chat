import {  TtsArchitecture } from 'react-native-nobodywho';

export const getTtsArchitecture = (family: string): TtsArchitecture | undefined => {
  const normalised = family.toLowerCase();
  if (normalised.includes('kokoro')) {
    return 'kokoro';
  }
  if (normalised.includes('supertonic')) {
    return 'supertonic';
  }
  return undefined;
};

