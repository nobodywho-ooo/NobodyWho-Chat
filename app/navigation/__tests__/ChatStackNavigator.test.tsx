import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';

import { mockUseModels } from 'jest/mock/hooks';
import { buildModel } from 'jest/factories/model';
import { getAppState, setAppState } from 'database';
import { InputBar } from '../../screens/ChatScreen/components/InputBar/InputBar';
import {
  getModelById,
  getConversationById,
  getMessagesByConversationId,
  insertConversation,
  insertMessage,
} from 'repositories';

import { ChatStackNavigator } from '../ChatStackNavigator';

jest.mock('@react-navigation/native-stack', () => {
  const mockReact = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: any) =>
        mockReact.createElement(mockReact.Fragment, null, children),
      Screen: ({ name, component }: any) =>
        name === 'ChatScreen' && component
          ? mockReact.createElement(component)
          : null,
    }),
  };
});

const mockChatInstance = {
  setChatHistory: jest.fn(async (_history: unknown[] = []) => {}),
  stopGeneration: jest.fn(),
  ask: jest.fn(),
};
const mockChatRef: { current: typeof mockChatInstance | undefined } = {
  current: undefined,
};
const mockCreateChat = jest.fn(async () => {
  mockChatRef.current = mockChatInstance;
});
const mockDisposeChat = jest.fn(() => {
  mockChatRef.current = undefined;
});

jest.mock('services', () => ({
  useAiService: () => ({
    chat: mockChatRef,
    createChat: mockCreateChat,
    disposeChat: mockDisposeChat,
  }),
}));

jest.mock('repositories', () => ({
  getModelById: jest.fn(),
  getConversationById: jest.fn(),
  getMessagesByConversationId: jest.fn(),
  insertConversation: jest.fn(),
  insertMessage: jest.fn(),
}));

const mockGetModelById = getModelById as jest.Mock;
const mockGetConversationById = getConversationById as jest.Mock;
const mockGetMessagesByConversationId =
  getMessagesByConversationId as jest.Mock;
const mockInsertConversation = insertConversation as jest.Mock;
const mockInsertMessage = insertMessage as jest.Mock;

beforeEach(async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(0)], loading: false });
  mockChatRef.current = undefined;
  mockCreateChat.mockClear();
  mockDisposeChat.mockClear();
  mockChatInstance.setChatHistory.mockReset().mockResolvedValue(undefined);
  mockChatInstance.ask
    .mockReset()
    .mockImplementation(async function* () {
      yield 'hello';
    });
  mockGetModelById.mockReset().mockResolvedValue(buildModel(0));
  mockGetConversationById.mockReset();
  mockGetMessagesByConversationId.mockReset().mockResolvedValue([]);
  mockInsertConversation.mockReset().mockResolvedValue(9);
  mockInsertMessage.mockReset().mockResolvedValue(1);
  // Reset the real appState store between tests.
  await setAppState({
    modelIdInUse: undefined,
    conversationIdInUse: undefined,
  });
});

test('shows NoModelDownloadedScreen when no model is downloaded', () => {
  mockUseModels.mockReturnValue({ models: [], loading: false });

  const screen = render(<ChatStackNavigator />);

  expect(
    screen.getByText('screens.noModelDownloaded.noModelAvailable'),
  ).toBeTruthy();
});

test('shows the loading screen while models are still loading', async () => {
  // Even with a model in use, the no-model placeholders must not flash before
  // the models query resolves.
  mockUseModels.mockReturnValue({ models: [], loading: true });
  await setAppState({ modelIdInUse: 0 });

  const screen = render(<ChatStackNavigator />);

  expect(screen.queryByText('screens.noModelDownloaded.noModelAvailable')).toBeNull();
  expect(screen.queryByText('screens.noModelSelected.pleaseSelectAModel')).toBeNull();
});

test('shows NoModelSelectedScreen and starts no session when no model is in use', () => {
  const screen = render(<ChatStackNavigator />);

  expect(
    screen.getByText('screens.noModelSelected.pleaseSelectAModel'),
  ).toBeTruthy();
  expect(mockCreateChat).not.toHaveBeenCalled();
});

test('mounts the in-use model and shows the empty chat', async () => {
  await setAppState({ modelIdInUse: 0 });

  const screen = render(<ChatStackNavigator />);

  await waitFor(() =>
    expect(screen.getByText('components.emptyChat.startAChat')).toBeTruthy(),
  );
  expect(mockCreateChat).toHaveBeenCalledWith({ model: buildModel(0) });
  expect(mockChatInstance.setChatHistory).toHaveBeenCalledWith([]);
});

test('shows the error screen when the in-use model cannot be resolved', async () => {
  mockGetModelById.mockResolvedValue(undefined);
  await setAppState({ modelIdInUse: 0 });

  const screen = render(<ChatStackNavigator />);

  await waitFor(() =>
    expect(screen.getByText('common.somethingWentWrong')).toBeTruthy(),
  );
  expect(mockCreateChat).not.toHaveBeenCalled();
});

test('disposes and rebuilds the chat when the in-use model changes', async () => {
  await setAppState({ modelIdInUse: 0 });
  mockGetModelById.mockImplementation(async (id: number) => buildModel(id));

  const screen = render(<ChatStackNavigator />);
  await waitFor(() =>
    expect(screen.getByText('components.emptyChat.startAChat')).toBeTruthy(),
  );

  await act(async () => {
    await setAppState({ modelIdInUse: 1, conversationIdInUse: undefined });
  });

  expect(mockDisposeChat).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(mockCreateChat).toHaveBeenCalledTimes(2));
  expect(mockCreateChat).toHaveBeenLastCalledWith({ model: buildModel(1) });
});

test('injects restored assistant messages with an empty toolCalls array', async () => {
  mockGetConversationById.mockResolvedValue({
    id: 5,
    title: 'Chat 5',
    lastUsed: 'now',
    modelId: 0,
  });
  mockGetMessagesByConversationId.mockResolvedValue([
    { id: 1, conversationId: 5, role: 'user', content: 'hi', documentsPath: [] },
    {
      id: 2,
      conversationId: 5,
      role: 'assistant',
      content: '<think>reasoning</think>answer',
      documentsPath: [],
    },
  ]);
  await setAppState({ modelIdInUse: 0, conversationIdInUse: 5 });

  render(<ChatStackNavigator />);

  await waitFor(() =>
    expect(mockChatInstance.setChatHistory).toHaveBeenCalled(),
  );
  const injected =
    mockChatInstance.setChatHistory.mock.calls[
      mockChatInstance.setChatHistory.mock.calls.length - 1
    ][0];
  expect(injected).toEqual([
    { role: 'user', content: 'hi' },
    // Raw content (incl. <think>) is injected; toolCalls present so the FFI
    // converter doesn't receive null.
    { role: 'assistant', content: '<think>reasoning</think>answer', toolCalls: [] },
  ]);
});

test('reloads only the history when the in-use conversation changes', async () => {
  await setAppState({ modelIdInUse: 0 });

  const screen = render(<ChatStackNavigator />);
  await waitFor(() =>
    expect(screen.getByText('components.emptyChat.startAChat')).toBeTruthy(),
  );

  mockGetConversationById.mockResolvedValue({
    id: 5,
    title: 'Chat 5',
    lastUsed: 'now',
    modelId: 0,
  });

  await act(async () => {
    await setAppState({ conversationIdInUse: 5 });
  });

  await waitFor(() =>
    expect(mockGetMessagesByConversationId).toHaveBeenCalledWith(5),
  );
  expect(mockDisposeChat).not.toHaveBeenCalled();
  expect(mockCreateChat).toHaveBeenCalledTimes(1);
});

test('switching conversations keeps the chat screen mounted (no loading flash)', async () => {
  await setAppState({ modelIdInUse: 0 });

  const screen = render(<ChatStackNavigator />);
  await waitFor(() =>
    expect(screen.getByText('components.emptyChat.startAChat')).toBeTruthy(),
  );

  mockGetConversationById.mockResolvedValue({
    id: 5,
    title: 'Chat 5',
    lastUsed: 'now',
    modelId: 0,
  });
  mockGetMessagesByConversationId.mockResolvedValue([
    { id: 1, conversationId: 5, role: 'user', content: 'hi', documentsPath: [] },
  ]);

  // Make the (non-empty) history injection hang so we can observe the in-between
  // state; the empty initial load already resolved above.
  let resolveSetHistory: () => void = () => {};
  mockChatInstance.setChatHistory.mockImplementation((history = []) =>
    history.length === 0
      ? Promise.resolve()
      : new Promise<void>(resolve => {
          resolveSetHistory = resolve;
        }),
  );

  await act(async () => {
    setAppState({ conversationIdInUse: 5 });
  });

  // History injection is still pending. The old design flipped status to Loading
  // (unmounting ChatScreen for the loading screen); the new design stays Ready, so
  // the previous conversation's content is still on screen instead of a flash.
  expect(screen.getByText('components.emptyChat.startAChat')).toBeTruthy();

  await act(async () => {
    resolveSetHistory();
  });
});

test('sending the first message persists in use without reloading the chat', async () => {
  await setAppState({ modelIdInUse: 0 });

  const screen = render(<ChatStackNavigator />);
  await waitFor(() =>
    expect(screen.getByText('components.emptyChat.startAChat')).toBeTruthy(),
  );
  // Only the initial empty load so far.
  expect(mockChatInstance.setChatHistory).toHaveBeenCalledTimes(1);

  const bar = screen.UNSAFE_getByType(InputBar as never);
  act(() => bar.props.onChangeText('first message'));
  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onSend();
  });

  // The new conversation is recorded as in use...
  expect(getAppState().conversationIdInUse).toBe(9);
  // ...but the navigator did NOT reload (no extra history load, no remount).
  expect(mockGetMessagesByConversationId).not.toHaveBeenCalled();
  expect(mockChatInstance.setChatHistory).toHaveBeenCalledTimes(1);
});

test('clearing the conversation after a load error reloads and recovers', async () => {
  // A conversation whose history fails to inject puts the session in error.
  mockGetConversationById.mockResolvedValue({
    id: 5,
    title: 'Chat 5',
    lastUsed: 'now',
    modelId: 0,
  });
  mockGetMessagesByConversationId.mockResolvedValue([
    { id: 1, conversationId: 5, role: 'user', content: 'hi', documentsPath: [] },
  ]);
  mockChatInstance.setChatHistory.mockImplementation(async (history = []) => {
    if (history.length > 0) {
      throw new Error('setChatHistory boom');
    }
  });
  await setAppState({ modelIdInUse: 0, conversationIdInUse: 5 });

  const screen = render(<ChatStackNavigator />);
  await waitFor(() =>
    expect(screen.getByText('common.somethingWentWrong')).toBeTruthy(),
  );

  // "New Chat" clears the conversation; the empty reload must clear the error.
  await act(async () => {
    await setAppState({ conversationIdInUse: undefined });
  });

  await waitFor(() =>
    expect(screen.getByText('components.emptyChat.startAChat')).toBeTruthy(),
  );
});
