import React from 'react';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { usePreventRemove } from '@react-navigation/native';

import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';

import { OnboardingContext } from '../../../hooks/useOnboarding';
import { OnboardingScreenProps } from '../../../Onboarding.types';
import { VoiceChoice } from '../VoiceChoice';

const mockDownloads = {
  findModelsToDownload: jest.fn((_curated: unknown) => [] as unknown[]),
};
const mockUseCuratedModels = jest.fn((_catalogue?: unknown) => mockDownloads);

jest.mock('hooks/useCuratedModels', () => ({
  useCuratedModels: (catalogue?: unknown) => mockUseCuratedModels(catalogue),
}));

const recommended = buildModel(1, { tags: ['Recommended'] });
const stt = buildModel(3, {
  pipeline: ModelPipeline.speechToText,
  tags: ['Recommended'],
});
const catalogue = [recommended, stt];

const navigation = { navigate: jest.fn(), setOptions: jest.fn() };

const renderChoice = (modelId = recommended.id, onFinish = jest.fn()) =>
  render(
    <OnboardingContext.Provider value={{ catalogue, onFinish }}>
      <VoiceChoice
        {...({
          navigation,
          route: {
            key: 'VoiceChoice',
            name: 'VoiceChoice',
            params: { modelId },
          },
        } as unknown as OnboardingScreenProps<'VoiceChoice'>)}
      />
    </OnboardingContext.Provider>,
  );

const headerOptions = () => navigation.setOptions.mock.lastCall[0];
const isRemovePrevented = () =>
  jest.mocked(usePreventRemove).mock.lastCall?.[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockDownloads.findModelsToDownload.mockReturnValue([]);
});

test('offers the two choices without the picked model, Skip in the header', async () => {
  const onFinish = jest.fn();
  await renderChoice(recommended.id, onFinish);

  expect(mockUseCuratedModels).toHaveBeenCalledWith(catalogue);
  screen.getByText('screens.onboarding.voiceHeader');
  screen.getByText('screens.onboarding.modalityTitle');
  screen.getByText('screens.onboarding.modalitySubtitle');
  expect(screen.queryByText(recommended.name)).toBeNull();
  within(screen.getByTestId('onboarding-text-only-button')).getByText(
    'screens.onboarding.textOnly',
  );
  within(screen.getByTestId('onboarding-text-voice-button')).getByText(
    'screens.onboarding.textAndVoice',
  );

  expect(headerOptions().headerBackVisible).toBe(true);
  expect(headerOptions().headerRight().props.onPress).toBe(onFinish);
  expect(isRemovePrevented()).toBe(false);
});

test('shows the size each choice would download', async () => {
  mockDownloads.findModelsToDownload.mockImplementation(curated =>
    (curated as unknown[]).length === 1 ? [recommended] : [],
  );
  await renderChoice();

  within(screen.getByTestId('onboarding-text-only-button')).getByText('1 GB');
  // Nothing to download for this choice: no size.
  expect(
    within(screen.getByTestId('onboarding-text-voice-button')).queryByText(
      /[GM]B$/,
    ),
  ).toBeNull();
});

test('hands the picked choice over to the download step', async () => {
  await renderChoice(recommended.id);

  await fireEvent.press(screen.getByTestId('onboarding-text-only-button'));
  expect(navigation.navigate).toHaveBeenLastCalledWith('OnboardingDownload', {
    modelId: recommended.id,
    setup: 'textOnly',
  });

  await fireEvent.press(screen.getByTestId('onboarding-text-voice-button'));
  expect(navigation.navigate).toHaveBeenLastCalledWith('OnboardingDownload', {
    modelId: recommended.id,
    setup: 'textAndVoice',
  });
});
