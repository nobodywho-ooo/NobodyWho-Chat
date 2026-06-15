import React from 'react';
import { render, act } from '@testing-library/react-native';

import {
  mockUseAppState,
  mockUseModels,
  mockUseConversations,
} from 'jest/mock/hooks';
import { mockSetAppState } from 'jest/mock/database';
import { mockDeleteConversation } from 'jest/mock/repositories';
import { buildConversation } from 'jest/factories/conversation';
import { buildModel } from 'jest/factories/model';
import { log } from 'helpers';
import { MenuView } from '@react-native-menu/menu';

import { DrawerNavigator } from '../DrawerNavigator';

const mockLog = log as jest.Mock;

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
});

test('shows the in-use conversation title and model name in the header', () => {
  const screen = render(<DrawerNavigator />);

  expect(screen.getByText('Conversation 5')).toBeTruthy();
  expect(screen.getByText('Model 1 (1B)')).toBeTruthy();
});

test('falls back to the default title when no conversation is in use', () => {
  mockUseAppState.mockReturnValue({
    modelIdInUse: 1,
    conversationIdInUse: undefined,
  });

  const screen = render(<DrawerNavigator />);

  expect(screen.getByText('Navigation.newChat')).toBeTruthy();
});

test('hides the header menu when no conversation is in use', () => {
  mockUseAppState.mockReturnValue({
    modelIdInUse: 1,
    conversationIdInUse: undefined,
  });

  const screen = render(<DrawerNavigator />);

  expect(screen.UNSAFE_queryByType(MenuView)).toBeNull();
});

test('shows the header menu with New Chat and Delete Chat actions', () => {
  const screen = render(<DrawerNavigator />);

  const actions = leafActions(screen.UNSAFE_getByType(MenuView).props.actions);

  expect(actions.map(action => action.id)).toEqual([
    'new-chat',
    'delete-chat',
  ]);
  expect(actions.map(action => action.title)).toEqual([
    'navigation.chatMenu.newChat',
    'navigation.chatMenu.deleteChat',
  ]);
  // Delete Chat is styled as a destructive action.
  expect(actions[1].attributes).toEqual({ destructive: true });
});

test('New Chat clears the conversation in use without deleting anything', async () => {
  const screen = render(<DrawerNavigator />);
  const { onPressAction } = screen.UNSAFE_getByType(MenuView).props;

  await act(async () => {
    await onPressAction({ nativeEvent: { event: 'new-chat' } });
  });

  expect(mockSetAppState).toHaveBeenCalledWith({ conversationIdInUse: undefined });
  expect(mockDeleteConversation).not.toHaveBeenCalled();
});

test('Delete Chat deletes the current conversation and starts a new chat', async () => {
  const screen = render(<DrawerNavigator />);
  const { onPressAction } = screen.UNSAFE_getByType(MenuView).props;

  await act(async () => {
    await onPressAction({ nativeEvent: { event: 'delete-chat' } });
  });

  expect(mockSetAppState).toHaveBeenCalledWith({ conversationIdInUse: undefined });
  expect(mockDeleteConversation).toHaveBeenCalledWith(5);
});

test('Delete Chat logs and recovers when the deletion fails', async () => {
  mockDeleteConversation.mockRejectedValueOnce(new Error('boom'));

  const screen = render(<DrawerNavigator />);
  const { onPressAction } = screen.UNSAFE_getByType(MenuView).props;

  await act(async () => {
    await onPressAction({ nativeEvent: { event: 'delete-chat' } });
  });

  // The chat is still cleared, and the failure is logged rather than thrown.
  expect(mockSetAppState).toHaveBeenCalledWith({ conversationIdInUse: undefined });
  expect(mockDeleteConversation).toHaveBeenCalledWith(5);
  expect(mockLog).toHaveBeenCalled();
});
