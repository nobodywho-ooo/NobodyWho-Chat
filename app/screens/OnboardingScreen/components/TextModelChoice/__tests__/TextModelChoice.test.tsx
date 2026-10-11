import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { usePreventRemove } from '@react-navigation/native';

import { CURATED_VOICE_ONLY_MODELS } from 'helpers';
import { buildModel } from 'jest/factories/model';
import { Model, ModelPipeline } from 'types';

import { OnboardingContext } from '../../../hooks/useOnboarding';
import { OnboardingScreenProps } from '../../../Onboarding.types';
import { TextModelChoice } from '../TextModelChoice';

const recommended = buildModel(1, { tags: ['Recommended'], order: 2 });
const firstPick = buildModel(2, { tags: ['Great First Pick'], order: 1 });
const untagged = buildModel(3);
const stt = buildModel(4, {
  pipeline: ModelPipeline.speechToText,
  tags: ['Recommended'],
});

// Voice models still to download unless a test says otherwise.
const mockFindCuratedToDownload = jest.fn(
  (curated: readonly unknown[]) => curated,
);

jest.mock('hooks/useCuratedModels', () => ({
  useCuratedModels: () => ({
    findCuratedToDownload: (curated: readonly unknown[]) =>
      mockFindCuratedToDownload(curated),
  }),
}));

const navigation = { navigate: jest.fn(), setOptions: jest.fn() };

const renderChoice = (catalogue: Model[], onFinish = jest.fn()) =>
  render(
    <OnboardingContext.Provider value={{ catalogue, onFinish }}>
      <TextModelChoice
        {...({
          navigation,
          route: { key: 'TextModelChoice', name: 'TextModelChoice' },
        } as unknown as OnboardingScreenProps<'TextModelChoice'>)}
      />
    </OnboardingContext.Provider>,
  );

const cardNames = () =>
  screen.getAllByRole('button').map(button => button.props.accessibilityLabel);

beforeEach(() => {
  jest.clearAllMocks();
  mockFindCuratedToDownload.mockImplementation(curated => curated);
});

test('suggests the tagged chat models in catalogue order', async () => {
  await renderChoice([recommended, firstPick, untagged, stt]);

  screen.getByText('screens.onboarding.header');
  screen.getByText('screens.onboarding.title');
  screen.getByText('screens.onboarding.subtitle');
  expect(cardNames()).toEqual([firstPick.name, recommended.name]);
});

test('falls back to every chat model when none is tagged', async () => {
  await renderChoice([untagged, stt]);

  expect(cardNames()).toEqual([untagged.name]);
});

test('pressing a model opens the voice choice for it', async () => {
  await renderChoice([recommended, firstPick]);

  await fireEvent.press(screen.getByLabelText(recommended.name));

  expect(navigation.navigate).toHaveBeenCalledWith('VoiceChoice', {
    modelId: recommended.id,
  });
});

test('goes straight to the download when the voice models are already there', async () => {
  mockFindCuratedToDownload.mockReturnValue([]);
  await renderChoice([recommended, firstPick]);

  await fireEvent.press(screen.getByLabelText(recommended.name));

  expect(mockFindCuratedToDownload).toHaveBeenCalledWith(
    CURATED_VOICE_ONLY_MODELS,
  );
  expect(navigation.navigate).toHaveBeenCalledWith('OnboardingDownload', {
    modelId: recommended.id,
    setup: 'textOnly',
  });
});

test('puts Skip in the header and leaves going back alone', async () => {
  const onFinish = jest.fn();
  await renderChoice([firstPick], onFinish);

  const options = navigation.setOptions.mock.lastCall[0];
  expect(options.headerBackVisible).toBe(true);
  expect(options.gestureEnabled).toBe(true);
  expect(options.headerRight().props.onPress).toBe(onFinish);
  expect(options.unstable_headerRightItems()).toEqual([
    expect.objectContaining({
      type: 'button',
      label: 'screens.onboarding.skip',
      onPress: onFinish,
    }),
  ]);
  expect(jest.mocked(usePreventRemove).mock.lastCall?.[0]).toBe(false);
});
