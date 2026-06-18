import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

import { mockSetAppState } from 'jest/mock/database';
import { mockUseAppState, mockUseModels } from 'jest/mock/hooks';
import { mockSetOptions, mockUseRoute } from 'jest/mock/node-modules';
import { buildModel } from 'jest/factories/model';

import { DownloadedModelsScreen } from '../DownloadedModelsScreen';

const headerToggle = () => {
  const headerRight = mockSetOptions.mock.calls.at(-1)![0].headerRight;
  const [toggle] = React.Children.toArray(
    headerRight().props.children,
  ) as React.ReactElement<{ onPress: () => void }>[];
  return toggle;
};

beforeEach(() => {
  mockUseModels.mockReturnValue({ models: [] });
  mockUseAppState.mockReturnValue({});
  mockUseRoute.mockReturnValue({ params: { canDelete: true } });
  mockSetAppState.mockClear();
  mockSetOptions.mockClear();
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

test('delete mode: confirming the alert deletes the in-use model and clears it from use', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const models = [buildModel(1), buildModel(2)];
  mockUseModels.mockReturnValue({ models });
  mockUseAppState.mockReturnValue({ modelIdInUse: 2 });

  const screen = render(<DownloadedModelsScreen />);

  // The delete toggle lives in the header (set via navigation.setOptions); it is
  // the first header-right action, with the close button after it on iOS.
  act(() => headerToggle().props.onPress());

  // In delete mode, pressing a model prompts for confirmation rather than
  // deleting outright.
  const card = screen.UNSAFE_getByProps({ model: models[1] });
  expect(card.props.deleteMode).toBe(true);
  act(() => card.props.onPress(models[1]));

  expect(alertSpy).toHaveBeenCalled();
  expect(mockSetAppState).not.toHaveBeenCalled();

  // Tapping the destructive confirm button performs the deletion.
  const buttons = alertSpy.mock.calls.at(-1)![2]!;
  const confirm = buttons.find(button => button.style === 'destructive')!;
  await act(async () => {
    confirm.onPress?.();
  });

  await waitFor(() =>
    expect(mockSetAppState).toHaveBeenCalledWith({
      modelIdInUse: undefined,
      conversationIdInUse: undefined,
    }),
  );
  alertSpy.mockRestore();
});

test('without canDelete (drawer entry) deletion is unavailable', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockUseRoute.mockReturnValue({ params: { canDelete: false } });
  const models = [buildModel(1), buildModel(2)];
  mockUseModels.mockReturnValue({ models });
  mockUseAppState.mockReturnValue({ modelIdInUse: 1 });

  const screen = render(<DownloadedModelsScreen />);

  // Pressing a model just selects it, with no confirmation alert. (Done before
  // rendering the header below, since a second render tree breaks fireEvent.)
  fireEvent.press(screen.UNSAFE_getByProps({ model: models[1] }), models[1]);
  expect(alertSpy).not.toHaveBeenCalled();
  expect(mockSetAppState).toHaveBeenCalledWith({
    modelIdInUse: 2,
    conversationIdInUse: undefined,
  });

  // No delete toggle is rendered in the header (no trash icon).
  const headerRight = mockSetOptions.mock.calls.at(-1)![0].headerRight;
  const header = render(headerRight());
  expect(header.UNSAFE_queryAllByProps({ iosIconName: 'trash' })).toHaveLength(0);

  alertSpy.mockRestore();
});
