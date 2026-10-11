import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type OnboardingParamList = {
  TextModelChoice: undefined;
  VoiceChoice: { modelId: number };
};

export type OnboardingScreenProps<Name extends keyof OnboardingParamList> =
  NativeStackScreenProps<OnboardingParamList, Name>;
