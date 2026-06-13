import React from 'react';
import { render, act } from '@testing-library/react-native';

import { InputBar } from '../components/InputBar/InputBar';
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
// Stable ref (like the real AiService) so a test can swap chat.current mid-stream.
const mockChatRef: { current: typeof mockChat | undefined } = { current: mockChat };
jest.mock('services', () => ({
  useAiService: () => ({ chat: mockChatRef }),
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
  mockChatRef.current = mockChat;
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
  expect(mockInsertMessage).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      conversationId: 42,
      role: 'assistant',
      content: 'Hello world',
      documentsPath: [],
      timeToFirstToken: expect.any(Number),
      tokensPerSecond: expect.any(Number),
    }),
  );
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

test('persists the user message before generation starts (crash-safety)', async () => {
  let userPersistedBeforeFirstToken = false;
  mockChat.ask.mockImplementation(() =>
    (async function* () {
      userPersistedBeforeFirstToken = mockInsertMessage.mock.calls.some(
        ([m]) => m.role === 'user' && m.content === 'Keep me',
      );
      yield 'ok';
    })(),
  );

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'Keep me');

  expect(userPersistedBeforeFirstToken).toBe(true);
});

test('records tokens/sec and time-to-first-token on the assistant message', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'metrics please');

  const assistantCall = mockInsertMessage.mock.calls.find(
    ([m]) => m.role === 'assistant',
  );
  expect(assistantCall?.[0]).toEqual(
    expect.objectContaining({
      tokensPerSecond: expect.any(Number),
      timeToFirstToken: expect.any(Number),
    }),
  );
});

test('a model swap mid-stream stops streaming without persisting the assistant', async () => {
  // Simulate disposeChat nulling chat.current after the first token arrives.
  mockChat.ask.mockImplementation(() =>
    (async function* () {
      yield 'partial';
      mockChatRef.current = undefined;
      yield 'ignored after swap';
    })(),
  );

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'hi');

  // The user message was persisted before streaming (crash-safety); the
  // assistant message is NOT, because the chat was swapped mid-stream.
  const roles = mockInsertMessage.mock.calls.map(([m]) => m.role);
  expect(roles).toContain('user');
  expect(roles).not.toContain('assistant');
});
