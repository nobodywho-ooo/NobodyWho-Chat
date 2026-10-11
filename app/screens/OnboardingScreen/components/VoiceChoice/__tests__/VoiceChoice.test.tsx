import React from 'react';
import { Alert } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { usePreventRemove } from '@react-navigation/native';

import { CURATED_VOICE_ONLY_MODELS } from 'helpers';
import { selectModel } from 'services';
import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';

import { OnboardingContext } from '../../../hooks/useOnboarding';
import { OnboardingScreenProps } from '../../../Onboarding.types';
import { VoiceChoice } from '../VoiceChoice';

const mockDownloads = {
  findModelsToDownload: jest.fn((_curated: unknown) => [] as unknown[]),
  isDownloading: false,
  progress: 0,
  downloadCurated: jest.fn(),
  cancel: jest.fn(),
};
const mockUseCuratedModels = jest.fn((_catalogue?: unknown) => mockDownloads);

jest.mock('hooks/useCuratedModels', () => ({
  useCuratedModels: (catalogue?: unknown) => mockUseCuratedModels(catalogue),
}));

jest.mock('services', () => ({
  selectModel: jest.fn(async () => true),
}));

const recommended = buildModel(1, { tags: ['Recommended'] });
const firstPick = buildModel(2, { tags: ['Great First Pick'] });
const stt = buildModel(3, {
  pipeline: ModelPipeline.speechToText,
  tags: ['Recommended'],
});
const tts = buildModel(4, {
  pipeline: ModelPipeline.textToSpeech,
  tags: ['Recommended'],
});
const vad = buildModel(5, {
  pipeline: ModelPipeline.voiceActivityDetection,
  tags: ['Recommended'],
});
const catalogue = [recommended, firstPick, stt, tts, vad];

const navigation = { setOptions: jest.fn() };

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
  mockDownloads.isDownloading = false;
  mockDownloads.progress = 0;
});

test('offers the two choices without the picked model, Skip in the header', async () => {
  const onFinish = jest.fn();
  await renderChoice(recommended.id, onFinish);

  expect(mockUseCuratedModels).toHaveBeenCalledWith(catalogue);
  screen.getByText('screens.onboarding.voiceHeader');
  expect(screen.queryByText('screens.onboarding.header')).toBeNull();
  screen.getByText('screens.onboarding.modalityTitle');
  screen.getByText('screens.onboarding.modalitySubtitle');
  expect(screen.queryByText(recommended.name)).toBeNull();
  within(screen.getByTestId('onboarding-text-only-button')).getByText(
    'screens.onboarding.textOnly',
  );
  within(screen.getByTestId('onboarding-text-voice-button')).getByText(
    'screens.onboarding.textAndVoice',
  );
  expect(screen.queryByTestId('onboarding-cancel-button')).toBeNull();

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

test('downloads only the picked text model, with the voice models on request', async () => {
  mockDownloads.downloadCurated.mockResolvedValue('cancelled');
  await renderChoice(recommended.id);

  await fireEvent.press(screen.getByTestId('onboarding-text-only-button'));
  const [curatedTextModels, options] =
    mockDownloads.downloadCurated.mock.lastCall;
  expect(options).toEqual({ alertOnFailure: false });
  expect(curatedTextModels).toHaveLength(1);
  expect(curatedTextModels[0].matches(recommended)).toBe(true);
  // Not the Great First Pick as well.
  expect(curatedTextModels[0].matches(firstPick)).toBe(false);

  await fireEvent.press(screen.getByTestId('onboarding-text-voice-button'));
  const [curatedVoiceModels] = mockDownloads.downloadCurated.mock.lastCall;
  expect(curatedVoiceModels).toEqual([
    curatedTextModels[0],
    ...CURATED_VOICE_ONLY_MODELS,
  ]);
});

test('shows All set once downloaded, and Start enters the app', async () => {
  mockDownloads.downloadCurated.mockResolvedValue('done');
  const onFinish = jest.fn();
  await renderChoice(recommended.id, onFinish);

  await fireEvent.press(screen.getByTestId('onboarding-text-voice-button'));

  screen.getByText('screens.onboarding.doneTitle');
  screen.getByText('screens.onboarding.doneSubtitle');
  expect(onFinish).not.toHaveBeenCalled();
  // No going back to the choices, nor skipping, once done.
  expect(headerOptions().headerBackVisible).toBe(false);
  expect(headerOptions().headerRight).toBeUndefined();
  expect(isRemovePrevented()).toBe(true);

  const start = screen.getByTestId('onboarding-start-button');
  expect(start.props.title).toBe('screens.onboarding.start');
  await fireEvent.press(start);
  expect(onFinish).toHaveBeenCalledTimes(1);
});

test('leaves selecting the picked model to the download itself', async () => {
  mockDownloads.downloadCurated.mockResolvedValue('done');
  await renderChoice(firstPick.id);

  await fireEvent.press(screen.getByTestId('onboarding-text-only-button'));

  expect(selectModel).not.toHaveBeenCalled();
  screen.getByText('screens.onboarding.doneTitle');
});

test('leaves for the app quietly when a model is still downloading in the background', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockDownloads.downloadCurated.mockResolvedValue('inProgress');
  const onFinish = jest.fn();
  await renderChoice(recommended.id, onFinish);

  await fireEvent.press(screen.getByTestId('onboarding-text-voice-button'));

  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('leaves for the app with an alert when the download fails', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockDownloads.downloadCurated.mockResolvedValue('failed');
  const onFinish = jest.fn();
  await renderChoice(recommended.id, onFinish);

  await fireEvent.press(screen.getByTestId('onboarding-text-only-button'));

  expect(alert).toHaveBeenCalledWith(
    'common.somethingWentWrong',
    'screens.onboarding.downloadUnavailable',
  );
  expect(onFinish).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});

test('stays on the choices when the models do not fit', async () => {
  mockDownloads.downloadCurated.mockResolvedValue('notEnoughSpace');
  const onFinish = jest.fn();
  await renderChoice(recommended.id, onFinish);

  await fireEvent.press(screen.getByTestId('onboarding-text-voice-button'));

  expect(onFinish).not.toHaveBeenCalled();
  screen.getByTestId('onboarding-text-voice-button');
});

test('shows progress and Cancel at the bottom while downloading, locked in place', async () => {
  mockDownloads.isDownloading = true;
  mockDownloads.progress = 0.42;
  await renderChoice();

  screen.getByText('screens.onboarding.downloadingHeader');
  expect(screen.queryByText('screens.onboarding.voiceHeader')).toBeNull();
  screen.getByText('screens.onboarding.downloadingTitle');
  screen.getByText('screens.onboarding.downloadProgress');
  expect(screen.queryByTestId('onboarding-text-only-button')).toBeNull();
  expect(screen.queryByTestId('onboarding-text-voice-button')).toBeNull();

  expect(headerOptions().headerBackVisible).toBe(false);
  expect(headerOptions().gestureEnabled).toBe(false);
  expect(headerOptions().headerRight).toBeUndefined();
  expect(headerOptions().unstable_headerRightItems).toBeUndefined();
  expect(isRemovePrevented()).toBe(true);

  const cancel = screen.getByTestId('onboarding-cancel-button');
  expect(cancel.props.title).toBe('common.cancel');
  await fireEvent.press(cancel);
  expect(mockDownloads.cancel).toHaveBeenCalledTimes(1);
});
