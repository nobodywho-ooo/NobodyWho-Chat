import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { mockSetAppState } from 'jest/mock/database';
import { mockNavigate } from 'jest/mock/node-modules';
import { mockUseModels } from 'jest/mock/hooks';
import { buildModel } from 'jest/factories/model';

import { DrawerContentScreen } from '../DrawerContentScreen';

beforeEach(() => {
  mockNavigate.mockClear();
  mockSetAppState.mockClear();
  mockUseModels.mockReturnValue({ models: [] });
});

test('renders correctly DrawerContentScreen', () => {
  const tree = render(
    <DrawerContentScreen onCloseDrawer={() => {}} />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('pressing settings navigates to the SettingsScreen', () => {
  const screen = render(<DrawerContentScreen onCloseDrawer={jest.fn()} />);

  fireEvent.press(screen.getByText('screens.drawerContent.settings'));

  expect(mockNavigate).toHaveBeenCalledWith('SettingsScreen');
});

test('pressing new chat clears the conversation in use and closes the drawer', () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });
  const onCloseDrawer = jest.fn();
  const screen = render(<DrawerContentScreen onCloseDrawer={onCloseDrawer} />);

  fireEvent.press(
    screen.UNSAFE_getByProps({ title: 'screens.drawerContent.newChat' }),
  );

  expect(mockSetAppState).toHaveBeenCalledWith({
    conversationIdInUse: undefined,
  });
  expect(onCloseDrawer).toHaveBeenCalled();
});

test('hides the new chat button when no model is downloaded', () => {
  mockUseModels.mockReturnValue({ models: [] });

  const screen = render(<DrawerContentScreen onCloseDrawer={jest.fn()} />);

  expect(
    screen.UNSAFE_queryByProps({ title: 'screens.drawerContent.newChat' }),
  ).toBeNull();
});

test('hides the change model button with fewer than 2 downloaded models', () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });

  const screen = render(<DrawerContentScreen onCloseDrawer={jest.fn()} />);

  expect(
    screen.queryByText('screens.drawerContent.changeModel'),
  ).toBeNull();
});

test('pressing change model navigates to the DownloadedModelsScreen when 2+ models are downloaded', () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1), buildModel(2)] });

  const screen = render(<DrawerContentScreen onCloseDrawer={jest.fn()} />);

  fireEvent.press(screen.getByText('screens.drawerContent.changeModel'));

  expect(mockNavigate).toHaveBeenCalledWith('DownloadedModelsScreen', {
    canDelete: false,
  });
});
