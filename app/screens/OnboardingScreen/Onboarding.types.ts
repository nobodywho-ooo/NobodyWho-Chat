import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ModelSetup } from 'helpers';

export type OnboardingParamList = {
  Welcome: undefined;
  TextModelChoice: undefined;
  VoiceChoice: { modelId: number };
  OnboardingDownload: { modelId: number; setup: ModelSetup };
};

export type OnboardingScreenProps<Name extends keyof OnboardingParamList> =
  NativeStackScreenProps<OnboardingParamList, Name>;
