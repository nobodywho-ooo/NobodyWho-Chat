import React from 'react';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { usePreventRemove } from '@react-navigation/native';

import type { CuratedAvailability } from 'helpers';
import type { CuratedModels } from 'hooks';
import { buildModel } from 'jest/factories/model';

import { OnboardingContext } from '../../../hooks/useOnboarding';
import { OnboardingScreenProps } from '../../../Onboarding.types';
import { VoiceChoice } from '../VoiceChoice';

const mockDownloads = {
  availabilityOf: jest.fn((_curated: unknown): CuratedAvailability => ({
    kind: 'ready',
  })),
};
const curatedModels = mockDownloads as unknown as CuratedModels;

const recommended = buildModel(1, { tags: ['Recommended'] });
const chatModels = [recommended];

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: () => true,
  setOptions: jest.fn(),
};

const renderChoice = (modelId = recommended.id, onFinish = jest.fn()) =>
  render(
    <OnboardingContext.Provider value={{ chatModels, onFinish, curatedModels }}>
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
  mockDownloads.availabilityOf.mockReturnValue({ kind: 'ready' });
});

test('offers the two choices without the picked model, Skip in the header', async () => {
  const onFinish = jest.fn();
  await renderChoice(recommended.id, onFinish);

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

  // iOS draws its own back button: the system one lands under the status
  // bar in landscape.
  expect(headerOptions().headerBackVisible).toBe(false);
  expect(headerOptions().headerLeft().props.onPress).toBe(navigation.goBack);
  expect(headerOptions().headerRight().props.onPress).toBe(onFinish);
  expect(isRemovePrevented()).toBe(false);
});

test('shows the size each choice would download', async () => {
  mockDownloads.availabilityOf.mockImplementation(curated =>
    (curated as unknown[]).length === 1
      ? { kind: 'automatic', models: [recommended], sizeGB: 1, pending: [] }
      : { kind: 'manual' },
  );
  await renderChoice();

  within(screen.getByTestId('onboarding-text-only-button')).getByText('1 GB');
  // Not an automatic download: no size.
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
