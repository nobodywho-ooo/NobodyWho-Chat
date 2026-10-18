import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';

import {
  mockUseAppState,
  mockUseModels,
  mockUseConversations,
} from 'jest/mock/hooks';
import { mockSetAppState } from 'jest/mock/database';
import { mockDeleteConversation } from 'jest/mock/repositories';
import { mockNavigate } from 'jest/mock/node-modules';
import { buildConversation } from 'jest/factories/conversation';
import { buildModel } from 'jest/factories/model';
import { log } from 'helpers';
import { AiServiceProvider } from 'services';

import { DrawerNavigator } from '../DrawerNavigator';

const mockLog = log as jest.Mock;

// The shared MenuView mock is a Fragment wrapper, which leaves nothing to find;
// a host mock keeps the menu (and its props) queryable here.
jest.mock('@react-native-menu/menu', () => ({ MenuView: 'MenuView' }));
const queryMenus = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.container.queryAll(node => node.type === 'MenuView');
const getMenu = (screen: Awaited<ReturnType<typeof render>>) => {
  const [menu] = queryMenus(screen);
  return menu;
};

// Flattens the iOS divider sections (`displayInline` groups) and the flat
// Android list to the underlying leaf actions.
const leafActions = (actions: any[]) =>
  actions.flatMap(action => action.subactions ?? [action]);

beforeEach(() => {
  mockUseAppState.mockReturnValue({ modelIdInUse: 1, conversationIdInUse: 5 });
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });
  mockUseConversations.mockReturnValue({
    conversations: [buildConversation(5, { title: 'Conversation 5' })],
  });
  mockSetAppState.mockClear();
  mockDeleteConversation.mockReset().mockResolvedValue(undefined);
  mockLog.mockClear();
  mockNavigate.mockClear();
});

const queryHeaderChevrons = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.container.queryAll(node => node.props.iosIconName === 'chevron.right');

test('shows only the in-use model name and parameter count in the header', async () => {
  const screen = await render(
    <AiServiceProvider>
      <DrawerNavigator />
    </AiServiceProvider>,
  );

  expect(screen.getByText('Model 1')).toBeTruthy();
  expect(screen.getByText('1B')).toBeTruthy();
  expect(screen.queryByText('Conversation 5')).toBeNull();
});

test('shows the model logo before its name in the header', async () => {
  mockUseModels.mockReturnValue({
    models: [buildModel(1, { family: 'Qwen3' })],
  });

  const screen = await render(
    <AiServiceProvider>
      <DrawerNavigator />
    </AiServiceProvider>,
  );

  expect(
    screen.container.queryAll(node => node.type === 'SvgMock'),
  ).toHaveLength(1);
});

test('pressing the header title opens the downloaded models screen', async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(1), buildModel(2)] });

  const screen = await render(
    <AiServiceProvider>
      <DrawerNavigator />
    </AiServiceProvider>,
  );

  expect(queryHeaderChevrons(screen)).toHaveLength(1);

  await fireEvent.press(screen.getByText('Model 1'));

  expect(mockNavigate).toHaveBeenCalledWith('Chat', {
    screen: 'DownloadedModelsScreen',
    params: { canDelete: false },
  });
});

// Mirrors the drawer, which only offers "Change model" with something to change to.
test('hides the header chevron and ignores presses with a single model', async () => {
  const screen = await render(
    <AiServiceProvider>
      <DrawerNavigator />
    </AiServiceProvider>,
  );

  expect(queryHeaderChevrons(screen)).toHaveLength(0);

  await fireEvent.press(screen.getByText('Model 1'));

  expect(mockNavigate).not.toHaveBeenCalled();
});

test('shows no header title when no model is in use', async () => {
  mockUseAppState.mockReturnValue({
    modelIdInUse: undefined,
    conversationIdInUse: undefined,
  });
  mockUseModels.mockReturnValue({ models: [buildModel(1), buildModel(2)] });

  const screen = await render(
    <AiServiceProvider>
      <DrawerNavigator />
    </AiServiceProvider>,
  );

  expect(screen.queryByText('Model 1')).toBeNull();
  expect(screen.queryByText('1B')).toBeNull();
  expect(queryHeaderChevrons(screen)).toHaveLength(0);
});

test('hides the header menu when no conversation is in use', async () => {
  mockUseAppState.mockReturnValue({
    modelIdInUse: 1,
    conversationIdInUse: undefined,
  });

  const screen = await render(
    <AiServiceProvider>
      <DrawerNavigator />
    </AiServiceProvider>,
  );

  expect(queryMenus(screen)).toHaveLength(0);
});

test('shows the header menu with New Chat and Delete Chat actions', async () => {
  const screen = await render(
    <AiServiceProvider>
      <DrawerNavigator />
    </AiServiceProvider>,
  );

  const actions = leafActions(getMenu(screen).props.actions);

  expect(actions.map(action => action.id)).toEqual(['new-chat', 'delete-chat']);
  expect(actions.map(action => action.title)).toEqual([
    'navigation.chatMenu.newChat',
    'navigation.chatMenu.deleteChat',
  ]);
  // Delete Chat is styled as a destructive action.
  expect(actions[1].attributes).toEqual({ destructive: true });
});

test('New Chat clears the conversation in use without deleting anything', async () => {
  const screen = await render(
    <AiServiceProvider>
      <DrawerNavigator />
    </AiServiceProvider>,
  );
  const { onPressAction } = getMenu(screen).props;

  await act(async () => {
    await onPressAction({ nativeEvent: { event: 'new-chat' } });
  });

  expect(mockSetAppState).toHaveBeenCalledWith({
    conversationIdInUse: undefined,
  });
  expect(mockDeleteConversation).not.toHaveBeenCalled();
});

test('Delete Chat deletes the current conversation and starts a new chat', async () => {
  const screen = await render(
    <AiServiceProvider>
      <DrawerNavigator />
    </AiServiceProvider>,
  );
  const { onPressAction } = getMenu(screen).props;

  await act(async () => {
    await onPressAction({ nativeEvent: { event: 'delete-chat' } });
  });

  expect(mockSetAppState).toHaveBeenCalledWith({
    conversationIdInUse: undefined,
  });
  expect(mockDeleteConversation).toHaveBeenCalledWith(5);
});

test('Delete Chat logs and recovers when the deletion fails', async () => {
  mockDeleteConversation.mockRejectedValueOnce(new Error('boom'));

  const screen = await render(
    <AiServiceProvider>
      <DrawerNavigator />
    </AiServiceProvider>,
  );
  const { onPressAction } = getMenu(screen).props;

  await act(async () => {
    await onPressAction({ nativeEvent: { event: 'delete-chat' } });
  });

  // The chat is still cleared, and the failure is logged rather than thrown.
  expect(mockSetAppState).toHaveBeenCalledWith({
    conversationIdInUse: undefined,
  });
  expect(mockDeleteConversation).toHaveBeenCalledWith(5);
  expect(mockLog).toHaveBeenCalled();
});
