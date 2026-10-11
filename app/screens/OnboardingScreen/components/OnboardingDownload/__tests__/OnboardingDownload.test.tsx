import React from 'react';
import { Alert } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { usePreventRemove } from '@react-navigation/native';

import { CURATED_VOICE_ONLY_MODELS, ModelSetup } from 'helpers';
import { getModelById } from 'repositories';
import { buildModel } from 'jest/factories/model';

import { OnboardingContext } from '../../../hooks/useOnboarding';
import { OnboardingScreenProps } from '../../../Onboarding.types';
import { OnboardingDownload } from '../OnboardingDownload';

const mockDownloads = {
  isLoaded: true,
  progress: 0,
  downloadCurated: jest.fn(),
  cancel: jest.fn(),
};
const mockUseCuratedModels = jest.fn((_catalogue?: unknown) => mockDownloads);

jest.mock('hooks/useCuratedModels', () => ({
  useCuratedModels: (catalogue?: unknown) => mockUseCuratedModels(catalogue),
}));

jest.mock('repositories', () => ({
  getModelById: jest.fn(async () => undefined),
}));

const recommended = buildModel(1, { tags: ['Recommended'] });
const firstPick = buildModel(2, { tags: ['Great First Pick'] });
const catalogue = [recommended, firstPick];

const navigation = { goBack: jest.fn(), setOptions: jest.fn() };

const renderDownload = ({
  modelId = recommended.id,
  setup = 'textOnly' as ModelSetup,
  onFinish = jest.fn(),
} = {}) =>
  render(
    <OnboardingContext.Provider value={{ catalogue, onFinish }}>
      <OnboardingDownload
        {...({
          navigation,
          route: {
            key: 'OnboardingDownload',
            name: 'OnboardingDownload',
            params: { modelId, setup },
          },
        } as unknown as OnboardingScreenProps<'OnboardingDownload'>)}
      />
    </OnboardingContext.Provider>,
  );

const headerOptions = () => navigation.setOptions.mock.lastCall[0];
const isRemovePrevented = () =>
  jest.mocked(usePreventRemove).mock.lastCall?.[0];

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockDownloads.isLoaded = true;
  mockDownloads.progress = 0;
  (getModelById as jest.Mock).mockResolvedValue(undefined);
  // Still running unless a test settles it.
  mockDownloads.downloadCurated.mockReturnValue(new Promise(() => {}));
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alertSpy.mockRestore();
});

test('downloads only the picked text model, once', async () => {
  const { rerender } = await renderDownload();
  await rerender(
    <OnboardingContext.Provider value={{ catalogue, onFinish: jest.fn() }}>
      <OnboardingDownload
        {...({
          navigation,
          route: { params: { modelId: recommended.id, setup: 'textOnly' } },
        } as unknown as OnboardingScreenProps<'OnboardingDownload'>)}
      />
    </OnboardingContext.Provider>,
  );

  expect(mockUseCuratedModels).toHaveBeenCalledWith(catalogue);
  expect(mockDownloads.downloadCurated).toHaveBeenCalledTimes(1);
  const [curated, options] = mockDownloads.downloadCurated.mock.lastCall;
  expect(options).toEqual({ alertOnFailure: false });
  expect(curated).toHaveLength(1);
  expect(curated[0].matches(recommended)).toBe(true);
  // Not the Great First Pick as well.
  expect(curated[0].matches(firstPick)).toBe(false);
});

test('waits for the installed models to load before downloading', async () => {
  mockDownloads.isLoaded = false;
  const { rerender } = await renderDownload();

  // Everything would look missing: nothing starts yet.
  expect(mockDownloads.downloadCurated).not.toHaveBeenCalled();
  screen.getByText('screens.onboarding.downloadingTitle');

  mockDownloads.isLoaded = true;
  await rerender(
    <OnboardingContext.Provider value={{ catalogue, onFinish: jest.fn() }}>
      <OnboardingDownload
        {...({
          navigation,
          route: { params: { modelId: recommended.id, setup: 'textOnly' } },
        } as unknown as OnboardingScreenProps<'OnboardingDownload'>)}
      />
    </OnboardingContext.Provider>,
  );

  expect(mockDownloads.downloadCurated).toHaveBeenCalledTimes(1);
});

test('adds the voice models on request', async () => {
  await renderDownload({ setup: 'textAndVoice' });

  const [curated] = mockDownloads.downloadCurated.mock.lastCall;
  expect(curated.slice(1)).toEqual([...CURATED_VOICE_ONLY_MODELS]);
});

test('shows progress and Cancel at the bottom, locked in place', async () => {
  mockDownloads.progress = 0.42;
  await renderDownload();

  screen.getByText('screens.onboarding.downloadingHeader');
  screen.getByText('screens.onboarding.downloadingTitle');
  screen.getByText('screens.onboarding.downloadProgress');

  expect(headerOptions().headerBackVisible).toBe(false);
  expect(headerOptions().gestureEnabled).toBe(false);
  expect(headerOptions().headerRight).toBeUndefined();
  expect(headerOptions().unstable_headerRightItems).toBeUndefined();
  expect(isRemovePrevented()).toBe(true);
});

test('Cancel stops the download and goes back once unlocked', async () => {
  await renderDownload();

  const cancel = screen.getByTestId('onboarding-cancel-button');
  expect(cancel.props.title).toBe('common.cancel');
  await fireEvent.press(cancel);

  expect(mockDownloads.cancel).toHaveBeenCalledTimes(1);
  expect(isRemovePrevented()).toBe(false);
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
});

test('shows All set once downloaded, and Start enters the app', async () => {
  mockDownloads.downloadCurated.mockResolvedValue('done');
  const onFinish = jest.fn();
  await renderDownload({ onFinish });

  await screen.findByText('screens.onboarding.doneTitle');
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

test('leaves for the app quietly when a model is still downloading in the background', async () => {
  mockDownloads.downloadCurated.mockResolvedValue('inProgress');
  const onFinish = jest.fn();
  await renderDownload({ onFinish });

  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(alertSpy).not.toHaveBeenCalled();
});

test('leaves for the app with an alert when the download fails', async () => {
  mockDownloads.downloadCurated.mockResolvedValue('failed');
  const onFinish = jest.fn();
  await renderDownload({ onFinish });

  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(alertSpy).toHaveBeenCalledWith(
    'common.somethingWentWrong',
    'screens.onboarding.downloadUnavailable',
  );
});

test('finishes with the chat model when only the voice models failed', async () => {
  mockDownloads.downloadCurated.mockResolvedValue('failed');
  (getModelById as jest.Mock).mockResolvedValue(recommended);
  const onFinish = jest.fn();
  await renderDownload({ setup: 'textAndVoice', onFinish });

  await screen.findByText('screens.onboarding.doneTitle');
  expect(getModelById).toHaveBeenCalledWith(recommended.id);
  expect(alertSpy).toHaveBeenCalledWith(
    'screens.models.downloadFailedTitle',
    'screens.onboarding.voiceUnavailable',
  );
  expect(onFinish).not.toHaveBeenCalled();
});

test('goes back to the choices when the models do not fit', async () => {
  mockDownloads.downloadCurated.mockResolvedValue('notEnoughSpace');
  const onFinish = jest.fn();
  await renderDownload({ onFinish });

  await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
  expect(onFinish).not.toHaveBeenCalled();
});
