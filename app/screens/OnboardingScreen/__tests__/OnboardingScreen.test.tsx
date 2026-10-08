import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { OnboardingScreen } from '../OnboardingScreen';

const mockDownloads = {
  isDownloading: false,
  progress: 0,
  downloadMissing: jest.fn(),
  cancel: jest.fn(),
};

jest.mock('../../ModelsScreen/useMissingModelDownloads', () => ({
  ...jest.requireActual('../../ModelsScreen/useMissingModelDownloads'),
  useMissingModelDownloads: () => mockDownloads,
}));

const {
  TEXT_REQUIREMENTS,
  VOICE_REQUIREMENTS,
} = require('../../ModelsScreen/useMissingModelDownloads');

beforeEach(() => {
  jest.clearAllMocks();
  mockDownloads.isDownloading = false;
  mockDownloads.progress = 0;
});

test('offers the two choices and Skip', () => {
  const onFinish = jest.fn();
  const { getByText, getByTestId } = render(
    <OnboardingScreen onFinish={onFinish} />,
  );

  getByText('screens.onboarding.header');
  getByText('screens.onboarding.title');
  getByText('screens.onboarding.subtitle');
  expect(getByTestId('onboarding-text-only-button').props.title).toBe(
    'screens.onboarding.textOnly',
  );
  expect(getByTestId('onboarding-text-voice-button').props.title).toBe(
    'screens.onboarding.textAndVoice',
  );

  const skip = getByTestId('onboarding-secondary-button');
  expect(skip.props.title).toBe('screens.onboarding.skip');
  fireEvent.press(skip);
  expect(onFinish).toHaveBeenCalledTimes(1);
});

test('downloads the matching requirements and finishes when done', async () => {
  mockDownloads.downloadMissing.mockResolvedValue('done');
  const onFinish = jest.fn();
  const { getByTestId } = render(<OnboardingScreen onFinish={onFinish} />);

  await act(async () => {
    fireEvent.press(getByTestId('onboarding-text-only-button'));
  });
  expect(mockDownloads.downloadMissing).toHaveBeenLastCalledWith(
    TEXT_REQUIREMENTS,
    { alertOnFailure: false },
  );

  await act(async () => {
    fireEvent.press(getByTestId('onboarding-text-voice-button'));
  });
  expect(mockDownloads.downloadMissing).toHaveBeenLastCalledWith(
    VOICE_REQUIREMENTS,
    { alertOnFailure: false },
  );
  expect(onFinish).toHaveBeenCalledTimes(2);
});

test('leaves for the app with an alert when the download fails', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockDownloads.downloadMissing.mockResolvedValue('failed');
  const onFinish = jest.fn();
  const { getByTestId } = render(<OnboardingScreen onFinish={onFinish} />);

  await act(async () => {
    fireEvent.press(getByTestId('onboarding-text-only-button'));
  });

  expect(alert).toHaveBeenCalledWith(
    'common.somethingWentWrong',
    'screens.onboarding.downloadUnavailable',
  );
  expect(onFinish).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});

test('stays on the choices when the models do not fit', async () => {
  mockDownloads.downloadMissing.mockResolvedValue({
    outcome: 'notEnoughSpace',
  });
  const onFinish = jest.fn();
  const { getByTestId } = render(<OnboardingScreen onFinish={onFinish} />);

  await act(async () => {
    fireEvent.press(getByTestId('onboarding-text-voice-button'));
  });

  expect(onFinish).not.toHaveBeenCalled();
  getByTestId('onboarding-text-voice-button');
});

test('shows progress and Cancel instead of the choices while downloading', () => {
  mockDownloads.isDownloading = true;
  mockDownloads.progress = 0.42;
  const { getByText, getByTestId, queryByTestId } = render(
    <OnboardingScreen onFinish={jest.fn()} />,
  );

  expect(queryByTestId('onboarding-text-only-button')).toBeNull();
  expect(queryByTestId('onboarding-text-voice-button')).toBeNull();
  getByText('screens.onboarding.downloadProgress');

  const cancel = getByTestId('onboarding-secondary-button');
  expect(cancel.props.title).toBe('common.cancel');
  fireEvent.press(cancel);
  expect(mockDownloads.cancel).toHaveBeenCalledTimes(1);
});
