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
  mockNavigate.mockClear();
  mockSetAppState.mockClear();
  mockUseModels.mockReturnValue({ models: [] });
});

test('renders correctly DrawerContentScreen', async () => {
  const tree = (
    await render(
      <AiServiceProvider>
        <DrawerContentScreen navigation={navigation} onCloseDrawer={() => {}} />
      </AiServiceProvider>,
    )
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('pressing settings navigates to the SettingsScreen', async () => {
  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  await fireEvent.press(screen.getByText('screens.drawerContent.settings'));

  expect(mockNavigate).toHaveBeenCalledWith('Chat', {
    screen: 'SettingsScreen',
  });
});

test('pressing new chat clears the conversation in use and closes the drawer', async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });
  const onCloseDrawer = jest.fn();
  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen
        navigation={navigation}
        onCloseDrawer={onCloseDrawer}
      />
    </AiServiceProvider>,
  );

  await fireEvent.press(getNewChatButton(screen));

  expect(mockSetAppState).toHaveBeenCalledWith({
    conversationIdInUse: undefined,
  });
  expect(onCloseDrawer).toHaveBeenCalled();
});

// The button floats over the conversations list rather than sitting below it,
// so without this room the last conversations come to rest underneath it and
// the button takes their taps.
test('the conversations list leaves room to scroll clear of the new chat button', async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });
  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
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

test('the conversations list reclaims the room when there is no new chat button', async () => {
  mockUseModels.mockReturnValue({ models: [] });

  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  expect(getConversationsList(screen).props.bottomInset).toBe(0);
});

test('hides the new chat button when no model is downloaded', async () => {
  mockUseModels.mockReturnValue({ models: [] });

  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  expect(queryNewChatButtons(screen)).toHaveLength(0);
});

test('hides the change model button with fewer than 2 downloaded models', async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });

  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  expect(screen.queryByText('screens.drawerContent.changeModel')).toBeNull();
});

test('pressing change model navigates to the DownloadedModelsScreen when 2+ models are downloaded', async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1), buildModel(2)] });

  const screen = await render(
    <AiServiceProvider>
      <DrawerContentScreen navigation={navigation} onCloseDrawer={jest.fn()} />
    </AiServiceProvider>,
  );

  await fireEvent.press(screen.getByText('screens.drawerContent.changeModel'));

  expect(mockNavigate).toHaveBeenCalledWith('Chat', {
    screen: 'DownloadedModelsScreen',
    params: { canDelete: false },
  });
});
