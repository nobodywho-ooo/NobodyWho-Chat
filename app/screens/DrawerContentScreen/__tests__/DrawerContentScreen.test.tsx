import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { mockSetAppState } from 'jest/mock/database';
import { mockNavigate } from 'jest/mock/node-modules';
import { mockUseModels } from 'jest/mock/hooks';
import { buildModel } from 'jest/factories/model';
import { AiServiceProvider } from 'services';

import { DrawerContentScreen } from '../DrawerContentScreen';
import { FLOATING_BUTTON_BOTTOM } from '../DrawerContentScreen.styles';

// DrawerContentScreen navigates via the navigation prop the drawer passes it
// (not useNavigation — that resolves to the parent navigator in drawer content).
const navigation = { navigate: mockNavigate } as never;

beforeEach(() => {
  mockNavigate.mockClear();
  mockSetAppState.mockClear();
  mockUseModels.mockReturnValue({ models: [] });
});

test('renders correctly DrawerContentScreen', () => {
  const tree = render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={() => {}} />
    </AiServiceProvider>,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('pressing settings navigates to the SettingsScreen', () => {
  const screen = render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  fireEvent.press(screen.getByText('screens.drawerContent.settings'));

  expect(mockNavigate).toHaveBeenCalledWith('Chat', {
    screen: 'SettingsScreen',
  });
});

test('pressing new chat clears the conversation in use and closes the drawer', () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });
  const onCloseDrawer = jest.fn();
  const screen = render(
    <AiServiceProvider>
      <DrawerContentScreen
        navigation={navigation}
        onCloseDrawer={onCloseDrawer}
      />
    </AiServiceProvider>,
  );

  fireEvent.press(
    screen.UNSAFE_getByProps({ title: 'screens.drawerContent.newChat' }),
  );

  expect(mockSetAppState).toHaveBeenCalledWith({
    conversationIdInUse: undefined,
  });
  expect(onCloseDrawer).toHaveBeenCalled();
});

// The button floats over the conversations list rather than sitting below it,
// so without this room the last conversations come to rest underneath it and
// the button takes their taps.
test('the conversations list leaves room to scroll clear of the new chat button', () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });
  const screen = render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  const list = () => screen.UNSAFE_getByType('ConversationsList' as never);
  const buttonHeight = 48;

  fireEvent(
    screen.UNSAFE_getByProps({ title: 'screens.drawerContent.newChat' }),
    'layout',
    { nativeEvent: { layout: { height: buttonHeight } } },
  );

  // Asserted against what the button actually occupies rather than against the
  // formula, so the room stays sufficient however the spacing is retuned.
  expect(list().props.bottomInset).toBeGreaterThan(
    FLOATING_BUTTON_BOTTOM + buttonHeight,
  );
});

test('the conversations list reclaims the room when there is no new chat button', () => {
  mockUseModels.mockReturnValue({ models: [] });

  const screen = render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  expect(
    screen.UNSAFE_getByType('ConversationsList' as never).props.bottomInset,
  ).toBe(0);
});

test('hides the new chat button when no model is downloaded', () => {
  mockUseModels.mockReturnValue({ models: [] });

  const screen = render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  expect(
    screen.UNSAFE_queryByProps({ title: 'screens.drawerContent.newChat' }),
  ).toBeNull();
});

test('hides the change model button with fewer than 2 downloaded models', () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });

  const screen = render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  expect(screen.queryByText('screens.drawerContent.changeModel')).toBeNull();
});

test('pressing change model navigates to the DownloadedModelsScreen when 2+ models are downloaded', () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1), buildModel(2)] });

  const screen = render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  fireEvent.press(screen.getByText('screens.drawerContent.changeModel'));

  expect(mockNavigate).toHaveBeenCalledWith('Chat', {
    screen: 'DownloadedModelsScreen',
    params: { canDelete: false },
  });
});
