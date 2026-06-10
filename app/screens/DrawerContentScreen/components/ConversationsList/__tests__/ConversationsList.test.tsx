import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { mockSetAppState } from 'jest/mock/database';
import { mockUseAppState, mockUseConversations } from 'jest/mock/hooks';
import { buildConversation } from 'jest/factories/conversation';

import { ConversationsList } from '../ConversationsList';

jest.unmock('../ConversationsList');

beforeEach(() => {
  mockUseConversations.mockReturnValue({ conversations: [] });
  mockUseAppState.mockReturnValue({});
  mockSetAppState.mockClear();
});

test('renders the conversations', () => {
  mockUseConversations.mockReturnValue({
    conversations: [buildConversation(1), buildConversation(2)],
  });

  const screen = render(<ConversationsList onCloseDrawer={jest.fn()} />);

  expect(screen.getByText('Conversation 1')).toBeTruthy();
  expect(screen.getByText('Conversation 2')).toBeTruthy();
});

test('renders the conversation in use in bold', () => {
  mockUseAppState.mockReturnValue({ conversationIdInUse: 2 });
  mockUseConversations.mockReturnValue({
    conversations: [buildConversation(1), buildConversation(2)],
  });

  const screen = render(<ConversationsList onCloseDrawer={jest.fn()} />);

  expect(screen.getByText('Conversation 2').props.bold).toBe(true);
  expect(screen.getByText('Conversation 1').props.bold).toBe(false);
});

test('renders the empty state when there are no conversations', () => {
  const screen = render(<ConversationsList onCloseDrawer={jest.fn()} />);

  expect(
    screen.getByText('components.conversationsList.noConversations'),
  ).toBeTruthy();
});

test('pressing a conversation opens it and closes the drawer', () => {
  const onCloseDrawer = jest.fn();
  // Belongs to a different model than any in use, so both ids must be set.
  const conversation = buildConversation(2, { modelId: 7 });
  mockUseConversations.mockReturnValue({
    conversations: [buildConversation(1), conversation],
  });

  const screen = render(<ConversationsList onCloseDrawer={onCloseDrawer} />);
  fireEvent.press(screen.getByText('Conversation 2'));

  expect(mockSetAppState).toHaveBeenCalledWith({
    modelIdInUse: 7,
    conversationIdInUse: 2,
  });
  expect(onCloseDrawer).toHaveBeenCalled();
});
