import React from 'react';
import { render, act } from '@testing-library/react-native';

import { InputBar } from 'components';
import { insertConversation, insertMessage } from 'repositories';

import { ChatScreen } from '../ChatScreen';

// ChatScreen reads only getAppState() from the store and `chat` from the
// service; mock both so handleSend can run without the real model/db.
jest.mock('database', () => ({
  getAppState: jest.fn(() => ({ modelIdInUse: 0 })),
}));

const mockChat = {
  ask: jest.fn(),
  stopGeneration: jest.fn(),
  setChatHistory: jest.fn(),
};
jest.mock('services', () => ({
  useAiService: () => ({ chat: { current: mockChat } }),
}));

jest.mock('repositories', () => ({
  insertConversation: jest.fn(),
  insertMessage: jest.fn(),
}));

const mockInsertConversation = insertConversation as jest.Mock;
const mockInsertMessage = insertMessage as jest.Mock;

// A finished stream that yields two tokens.
const stream = async function* () {
  yield 'Hello';
  yield ' world';
};

beforeEach(() => {
  mockChat.ask.mockReset().mockImplementation(() => stream());
  mockInsertConversation.mockReset().mockResolvedValue(42);
  mockInsertMessage.mockReset().mockResolvedValue(1);
});

const send = async (
  screen: ReturnType<typeof render>,
  text: string,
): Promise<void> => {
  const bar = screen.UNSAFE_getByType(InputBar as never);
  act(() => bar.props.onChangeText(text));
  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onSend();
  });
};

test('first send creates a conversation, persists both messages and notifies', async () => {
  const onConversationCreated = jest.fn();
  const screen = render(
    <ChatScreen
      conversationId={undefined}
      messages={[]}
      onConversationCreated={onConversationCreated}
    />,
  );

  await send(screen, 'Hi there');

  expect(mockInsertConversation).toHaveBeenCalledWith({
    title: 'Hi there',
    modelId: 0,
  });
  expect(mockInsertMessage).toHaveBeenCalledTimes(2);
  expect(mockInsertMessage).toHaveBeenNthCalledWith(1, {
    conversationId: 42,
    role: 'user',
    content: 'Hi there',
    documentsPath: [],
  });
  expect(mockInsertMessage).toHaveBeenNthCalledWith(2, {
    conversationId: 42,
    role: 'assistant',
    content: 'Hello world',
    documentsPath: [],
  });
  expect(onConversationCreated).toHaveBeenCalledWith(42);
});

test('a second send appends to the same conversation without creating another', async () => {
  const screen = render(
    <ChatScreen
      conversationId={undefined}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'first');
  mockInsertConversation.mockClear();
  mockInsertMessage.mockClear();

  await send(screen, 'second');

  expect(mockInsertConversation).not.toHaveBeenCalled();
  expect(mockInsertMessage).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ conversationId: 42, role: 'user', content: 'second' }),
  );
});

test('an existing conversation never creates a new one', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'hello');

  expect(mockInsertConversation).not.toHaveBeenCalled();
  expect(mockInsertMessage).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ conversationId: 7 }),
  );
});
