import React from 'react';
import { render } from '@testing-library/react-native';

import { mockUseAppState, mockUseModels } from 'jest/mock/hooks';
import { buildModel } from 'jest/factories/model';

import { DownloadedModelsScreen } from '../DownloadedModelsScreen';

beforeEach(() => {
  mockUseModels.mockReturnValue({ models: [] });
  mockUseAppState.mockReturnValue({});
});

test('renders correctly ModelsScreen when empty', () => {
  const screen = render(<DownloadedModelsScreen />);
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders downloaded models with one selected', () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1), buildModel(2)] });
  mockUseAppState.mockReturnValue({ modelIdInUse: 2 });

  const screen = render(<DownloadedModelsScreen />);
  expect(screen.toJSON()).toMatchSnapshot();
});
