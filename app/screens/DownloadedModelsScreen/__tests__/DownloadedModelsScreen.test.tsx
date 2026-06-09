import React from 'react';
import { render, act } from '@testing-library/react-native';

import { mockUseModels } from 'jest/mock/hooks';
import { mockGetModelIdInUse } from 'jest/mock/database';
import { buildModel } from 'jest/factories/model';

import { DownloadedModelsScreen } from '../DownloadedModelsScreen';

beforeEach(() => {
  mockUseModels.mockReturnValue({ models: [] });
  mockGetModelIdInUse.mockResolvedValue(undefined);
});

test('renders correctly ModelsScreen when empty', async () => {
  const screen = render(<DownloadedModelsScreen />);
  // Flush async effects (getModelIdInUse) so their state updates run inside act.
  await act(async () => {});
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders downloaded models with one selected', async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1), buildModel(2)] });
  mockGetModelIdInUse.mockResolvedValue(2);

  const screen = render(<DownloadedModelsScreen />);
  // Flush async effects so the selected model resolves inside act.
  await act(async () => {});
  expect(screen.toJSON()).toMatchSnapshot();
});
