import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { mockSetAppState } from 'jest/mock/database';
import { mockUseAppState, mockUseModels } from 'jest/mock/hooks';
import { buildModel } from 'jest/factories/model';

import { DownloadedModelsScreen } from '../DownloadedModelsScreen';

beforeEach(() => {
  mockUseModels.mockReturnValue({ models: [] });
  mockUseAppState.mockReturnValue({});
  mockSetAppState.mockClear();
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

test('pressing a model puts it in use, clear the conversation', () => {
  const models = [buildModel(1), buildModel(2)];
  mockUseModels.mockReturnValue({ models });
  mockUseAppState.mockReturnValue({ modelIdInUse: 1 });

  const screen = render(<DownloadedModelsScreen />);
  fireEvent.press(screen.UNSAFE_getByProps({ model: models[1] }), models[1]);

  expect(mockSetAppState).toHaveBeenCalledWith({
    modelIdInUse: 2,
    conversationIdInUse: undefined,
  });
});
