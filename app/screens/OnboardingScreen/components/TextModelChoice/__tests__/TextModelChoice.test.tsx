import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { usePreventRemove } from '@react-navigation/native';

import {
  CURATED_VOICE_ONLY_MODELS,
  CuratedModel,
  CuratedAvailability,
} from 'helpers';
import type { CuratedModels } from 'hooks';
import { buildModel } from 'jest/factories/model';
import { Model, ModelPipeline } from 'types';

import { OnboardingContext } from '../../../hooks/useOnboarding';
import { OnboardingScreenProps } from '../../../Onboarding.types';
import { TextModelChoice } from '../TextModelChoice';

const firstPick = buildModel(1, { tags: ['Great First Pick'] });
const recommended = buildModel(2, { tags: ['Recommended'] });
const stt = buildModel(4, {
  pipeline: ModelPipeline.speechToText,
  tags: ['Recommended'],
});

// Voice models still to download and fitting unless a test says otherwise.
const mockAvailabilityOf = jest.fn(
  (_curated: unknown): CuratedAvailability => ({
    kind: 'automatic',
    models: [recommended, stt],
    sizeGB: 2,
    pending: [],
  }),
);

const curatedModels = {
  availabilityOf: (curated: unknown) => mockAvailabilityOf(curated),
} as unknown as CuratedModels;

const navigation = {
  navigate: jest.fn(),
  canGoBack: () => false,
  setOptions: jest.fn(),
};

const renderChoice = (chatModels: Model[], onFinish = jest.fn()) =>
  render(
    <OnboardingContext.Provider value={{ chatModels, onFinish, curatedModels }}>
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
});

test('offers the chat models it is given, in that order', async () => {
  await renderChoice([firstPick, recommended]);

  screen.getByText('screens.onboarding.header');
  screen.getByText('screens.onboarding.title');
  screen.getByText('screens.onboarding.subtitle');
  expect(cardNames()).toEqual([firstPick.name, recommended.name]);
});

test('pressing a model opens the voice choice for it', async () => {
  await renderChoice([firstPick, recommended]);

  await fireEvent.press(screen.getByLabelText(recommended.name));

  // The picked model with the voice models.
  const [[pickedChat, ...voice]] = mockAvailabilityOf.mock.lastCall as [
    CuratedModel[],
  ];
  expect(pickedChat.matches(recommended)).toBe(true);
  expect(pickedChat.matches(firstPick)).toBe(false);
  expect(voice).toEqual(CURATED_VOICE_ONLY_MODELS);
  expect(navigation.navigate).toHaveBeenCalledWith('VoiceChoice', {
    modelId: recommended.id,
  });
});

test.each<[string, CuratedAvailability]>([
  [
    'the voice models are already there',
    { kind: 'automatic', models: [recommended], sizeGB: 1, pending: [] },
  ],
  ['the voice models do not fit next to it', { kind: 'manual' }],
])(
  'goes straight to the text download when %s',
  async (_case, voiceAvailability) => {
    mockAvailabilityOf.mockReturnValueOnce(voiceAvailability);
    await renderChoice([firstPick, recommended]);

    await fireEvent.press(screen.getByLabelText(recommended.name));

    expect(navigation.navigate).toHaveBeenCalledWith('OnboardingDownload', {
      modelId: recommended.id,
      setup: 'textOnly',
    });
  },
);

test('puts Skip in the header and leaves going back alone', async () => {
  const onFinish = jest.fn();
  await renderChoice([firstPick], onFinish);

  const options = navigation.setOptions.mock.lastCall[0];
  expect(options.headerBackVisible).toBe(false);
  expect(options.headerLeft).toBeUndefined();
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
