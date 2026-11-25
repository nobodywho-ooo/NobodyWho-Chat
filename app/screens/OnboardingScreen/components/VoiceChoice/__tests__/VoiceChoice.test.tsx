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
import { ModelPipeline } from 'types';

import { OnboardingContext } from '../../../hooks/useOnboarding';
import { OnboardingScreenProps } from '../../../Onboarding.types';
import { VoiceChoice } from '../VoiceChoice';

const mockDownloads = {
  availabilityOf: jest.fn((_curated: unknown): CuratedAvailability => ({
    kind: 'ready',
  })),
  ramGB: undefined as number | undefined,
};
const curatedModels = mockDownloads as unknown as CuratedModels;

const recommended = buildModel(1, { tags: ['Recommended'] });
const chatModels = [recommended];

const navigation = { navigate: jest.fn(), setOptions: jest.fn() };

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
  mockDownloads.ramGB = undefined;
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

  expect(headerOptions().headerBackVisible).toBe(true);
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

describe('the search options', () => {
  const chatPart = {
    url: 'https://example.com/model.gguf',
    fileName: 'model.gguf',
    type: 'chat-model',
    path: '',
    sizeGB: 2.5,
  };
  const bigChat = buildModel(7, { tags: ['Recommended'], parts: [chatPart] });
  const embedding = buildModel(8, {
    pipeline: ModelPipeline.featureExtraction,
    tags: ['Recommended'],
    parts: [{ ...chatPart, type: 'embedding-model', sizeGB: 0.31 }],
  });

  const renderSearchChoice = () =>
    render(
      <OnboardingContext.Provider
        value={{ chatModels: [bigChat], onFinish: jest.fn(), curatedModels }}
      >
        <VoiceChoice
          {...({
            navigation,
            route: {
              key: 'VoiceChoice',
              name: 'VoiceChoice',
              params: { modelId: bigChat.id },
            },
          } as unknown as OnboardingScreenProps<'VoiceChoice'>)}
        />
      </OnboardingContext.Provider>,
    );

  beforeEach(() => {
    mockDownloads.availabilityOf.mockImplementation(() => ({
      kind: 'automatic',
      models: [bigChat, embedding],
      sizeGB: 2.81,
      pending: [],
    }));
  });

  test('are offered on a phone with room for the search model', async () => {
    mockDownloads.ramGB = 12;
    await renderSearchChoice();

    screen.getByText('screens.onboarding.modalityWithSearchTitle');
    screen.getByText('screens.onboarding.modalityWithSearchSubtitle');
    within(screen.getByTestId('onboarding-text-search-button')).getByText(
      'screens.onboarding.textAndSearch',
    );
    within(screen.getByTestId('onboarding-all-models-button')).getByText(
      'screens.onboarding.allModels',
    );

    await fireEvent.press(screen.getByTestId('onboarding-text-search-button'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('OnboardingDownload', {
      modelId: bigChat.id,
      setup: 'textAndSearch',
    });

    await fireEvent.press(screen.getByTestId('onboarding-all-models-button'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('OnboardingDownload', {
      modelId: bigChat.id,
      setup: 'allModels',
    });
  });

  test('come after the voice option, in the order of what they add', async () => {
    mockDownloads.ramGB = 12;
    await renderSearchChoice();

    const order = [
      'onboarding-text-only-button',
      'onboarding-text-voice-button',
      'onboarding-text-search-button',
      'onboarding-all-models-button',
    ];
    const ids = screen.container
      .queryAll(node => order.includes(node.props.testID))
      .map(node => node.props.testID)
      .filter((id, index, all) => all.indexOf(id) === index);
    expect(ids).toEqual(order);
  });

  test('are left out on a phone that would run search in low-memory mode', async () => {
    mockDownloads.ramGB = 6;
    await renderSearchChoice();

    screen.getByText('screens.onboarding.modalityTitle');
    expect(screen.queryByTestId('onboarding-text-search-button')).toBeNull();
    expect(screen.queryByTestId('onboarding-all-models-button')).toBeNull();
  });

  test('are left out when the device memory is unknown', async () => {
    await renderSearchChoice();

    expect(screen.queryByTestId('onboarding-text-search-button')).toBeNull();
    expect(screen.queryByTestId('onboarding-all-models-button')).toBeNull();
  });
});
