import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { mockSetAppState } from 'jest/mock/database';
import { mockRouter, mockUseSafeAreaInsets } from 'jest/mock/node-modules';
import { mockUseModels } from 'jest/mock/hooks';
import { buildModel } from 'jest/factories/model';
import { AiServiceProvider } from 'services';
import { ModelPipeline } from 'types';

import { DrawerContentScreen } from '../DrawerContentScreen';
import { FLOATING_BUTTON_BOTTOM } from '../DrawerContentScreen.styles';

// Button and ConversationsList are host-mocked, so they're found through the
// container by their props / host type.
type Screen = Awaited<ReturnType<typeof render>>;
const queryNewChatButtons = (screen: Screen) =>
  screen.container.queryAll(
    node => node.props.title === 'screens.drawerContent.newChat',
  );
const getNewChatButton = (screen: Screen) => {
  const [button] = queryNewChatButtons(screen);
  return button;
};
const getConversationsList = (screen: Screen) => {
  const [list] = screen.container.queryAll(
    node => node.type === 'ConversationsList',
  );
  return list;
};

beforeEach(() => {
  mockRouter.navigate.mockClear();
  mockSetAppState.mockClear();
  mockUseModels.mockReturnValue({ models: [] });
});

test('renders correctly DrawerContentScreen', async () => {
  const tree = (
    await render(
      <AiServiceProvider>
        <DrawerContentScreen onCloseDrawer={() => {}} />
      </AiServiceProvider>,
    )
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('pressing the settings icon replaces the chat with the Settings destination', async () => {
  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  await fireEvent.press(
    screen.getByLabelText('screens.drawerContent.settings'),
  );

  expect(mockRouter.navigate).toHaveBeenCalledWith('/settings');
});

test('as a sidebar, offers to hide it in place of the close button', async () => {
  const onHideSidebar = jest.fn();
  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen
        onCloseDrawer={jest.fn()}
        onHideSidebar={onHideSidebar}
      />
    </AiServiceProvider>,
  );

  const iconButtons = screen.container.queryAll(
    node => node.type === 'IconButton',
  );
  expect(iconButtons.map(node => node.props.icon.iosIconName)).toEqual([
    'sidebar.left',
    'gearshape',
  ]);

  await fireEvent.press(screen.getByLabelText('navigation.hideSidebar'));
  expect(onHideSidebar).toHaveBeenCalledTimes(1);
});

test('pressing models replaces the chat with the Models destination', async () => {
  const onCloseDrawer = jest.fn();
  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen onCloseDrawer={onCloseDrawer} />
    </AiServiceProvider>,
  );

  await fireEvent.press(screen.getByText('screens.drawerContent.models'));

  expect(mockRouter.navigate).toHaveBeenCalledWith('/models');
  expect(onCloseDrawer).toHaveBeenCalled();
});

test('pressing new chat clears the conversation in use, shows the chat and closes the drawer', async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });
  const onCloseDrawer = jest.fn();
  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen onCloseDrawer={onCloseDrawer} />
    </AiServiceProvider>,
  );

  await fireEvent.press(getNewChatButton(screen));

  expect(mockSetAppState).toHaveBeenCalledWith({
    conversationIdInUse: undefined,
  });
  expect(mockRouter.navigate).toHaveBeenCalledWith('/');
  expect(onCloseDrawer).toHaveBeenCalled();
});

// The button floats over the conversations list rather than sitting below it,
// so without this room the last conversations come to rest underneath it and
// the button takes their taps.
test('the conversations list leaves room to scroll clear of the new chat button', async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });
  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  const list = () => getConversationsList(screen);
  const buttonHeight = 48;

  await fireEvent(getNewChatButton(screen), 'layout', {
    nativeEvent: { layout: { height: buttonHeight } },
  });

  // Asserted against what the button actually occupies rather than against the
  // formula, so the room stays sufficient however the spacing is retuned.
  expect(list().props.bottomInset).toBeGreaterThan(
    FLOATING_BUTTON_BOTTOM + buttonHeight,
  );
});

// An opaque 3-button navigation bar (e.g. Samsung) reports a bottom inset taller
// than the button's default offset, and would cover the button.
test('the new chat button floats above the system navigation bar', async () => {
  const navigationBarHeight = 48;
  mockUseSafeAreaInsets.mockReturnValue({
    top: 0,
    right: 0,
    bottom: navigationBarHeight,
    left: 0,
  });
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });
  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  const { bottom } = StyleSheet.flatten(getNewChatButton(screen).props.style);
  expect(bottom).toBeGreaterThan(navigationBarHeight);

  mockUseSafeAreaInsets.mockReturnValue({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });
});

test('the conversations list reclaims the room when there is no new chat button', async () => {
  mockUseModels.mockReturnValue({ models: [] });

  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  expect(getConversationsList(screen).props.bottomInset).toBe(0);
});

test('hides the new chat button when no model is downloaded', async () => {
  mockUseModels.mockReturnValue({ models: [] });

  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  expect(queryNewChatButtons(screen)).toHaveLength(0);
});

test('hides the new chat button when only voice models are downloaded', async () => {
  mockUseModels.mockReturnValue({
    models: [
      buildModel(1, { pipeline: ModelPipeline.textToSpeech }),
      buildModel(2, { pipeline: ModelPipeline.speechToText }),
    ],
  });

  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  expect(queryNewChatButtons(screen)).toHaveLength(0);
});

test('has no change model button: the chat header does that', async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1), buildModel(2)] });

  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  expect(screen.queryByText('screens.drawerContent.changeModel')).toBeNull();
});
