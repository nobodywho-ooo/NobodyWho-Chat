import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { render, act, waitFor } from '@testing-library/react-native';

import { mockUseModels } from 'jest/mock/hooks';
import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';
import { fireContainerLayout } from 'jest/layout';
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
// These suites only exercise text models; mock-prefixed so the jest.mock
// factory may reference it (out-of-scope enums are rejected otherwise).
const mockChatPipeline = ModelPipeline.textGeneration;

jest.mock('services', () => ({
  useAiService: () => ({
    chat: mockChatRef,
    chatPipeline: mockChatPipeline,
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

// Drive whether one of our own system pickers (photo library / document picker)
// is on screen, so a test can assert the navigator distinguishes that from a
// real background. Everything else in 'helpers' stays real.
let mockExternalPickerActive = false;
jest.mock('helpers', () => ({
  ...jest.requireActual('helpers'),
  isExternalPickerActive: () => mockExternalPickerActive,
}));

const mockGetModelById = getModelById as jest.Mock;
const mockGetConversationById = getConversationById as jest.Mock;
const mockGetMessagesByConversationId =
  getMessagesByConversationId as jest.Mock;
const mockInsertConversation = insertConversation as jest.Mock;
const mockInsertMessage = insertMessage as jest.Mock;

// Captures the handler the navigator registers so tests can drive OS
// background/foreground transitions directly.
let appStateHandler: (state: AppStateStatus) => void = () => {};

beforeEach(async () => {
  mockExternalPickerActive = false;
  appStateHandler = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
    appStateHandler = handler as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
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

// The empty chat is gated on a measured container height; jsdom never lays out,
// so wait for the chat screen to mount, fire its layout, then confirm the empty
// state is visible.
const showEmptyChat = (screen: ReturnType<typeof render>) =>
  waitFor(() => {
    fireContainerLayout(screen);
    expect(screen.getByText('components.emptyChat.startAChat')).toBeTruthy();
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

  // A model is in use, so a session starts asynchronously; flush it so its
  // state updates are wrapped in act and don't leak past the test.
  await waitFor(() => expect(mockChatInstance.setChatHistory).toHaveBeenCalled());
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

  await showEmptyChat(screen);
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
  await showEmptyChat(screen);

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
    { role: 'user', content: 'hi', documentsPath: [] },
    // Raw content (incl. <think>) is injected; toolCalls present so the FFI
    // converter doesn't receive null.
    {
      role: 'assistant',
      content: '<think>reasoning</think>answer',
      toolCalls: [],
    },
  ]);
});

test('reloads only the history when the in-use conversation changes', async () => {
  await setAppState({ modelIdInUse: 0 });

  const screen = render(<ChatStackNavigator />);
  await showEmptyChat(screen);

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
  await showEmptyChat(screen);

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
  await showEmptyChat(screen);
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

  await showEmptyChat(screen);
});

test('unloads the chat on background and rebuilds it on foreground', async () => {
  await setAppState({ modelIdInUse: 0 });

  const screen = render(<ChatStackNavigator />);
  await showEmptyChat(screen);
  expect(mockCreateChat).toHaveBeenCalledTimes(1);

  // Backgrounding frees the native model.
  await act(async () => {
    appStateHandler('background');
  });
  expect(mockDisposeChat).toHaveBeenCalledTimes(1);

  // Returning to the foreground rebuilds the model + history from scratch.
  await act(async () => {
    appStateHandler('active');
  });
  await waitFor(() => expect(mockCreateChat).toHaveBeenCalledTimes(2));
});

test('keeps the model resident when our own picker backgrounds the app', async () => {
  await setAppState({ modelIdInUse: 0 });

  const screen = render(<ChatStackNavigator />);
  await showEmptyChat(screen);
  expect(mockCreateChat).toHaveBeenCalledTimes(1);

  // Opening the photo library / document picker pauses our Activity, which RN
  // reports as 'background' — but the model must stay loaded so the composing
  // ChatScreen (its text + attachment) survives the round trip.
  mockExternalPickerActive = true;
  await act(async () => {
    appStateHandler('background');
  });
  expect(mockDisposeChat).not.toHaveBeenCalled();

  // Returning from the picker must not rebuild the model either.
  mockExternalPickerActive = false;
  await act(async () => {
    appStateHandler('active');
  });
  expect(mockCreateChat).toHaveBeenCalledTimes(1);
});

test('does not unload on the transient inactive state', async () => {
  await setAppState({ modelIdInUse: 0 });

  const screen = render(<ChatStackNavigator />);
  await showEmptyChat(screen);

  // iOS emits 'inactive' for Control Center / app switcher / Face ID — the
  // model must stay resident, and a following 'active' must not rebuild it.
  await act(async () => {
    appStateHandler('inactive');
  });
  await act(async () => {
    appStateHandler('active');
  });

  expect(mockDisposeChat).not.toHaveBeenCalled();
  expect(mockCreateChat).toHaveBeenCalledTimes(1);
});

test('does not unload on background when no model is in use', async () => {
  const screen = render(<ChatStackNavigator />);
  expect(
    screen.getByText('screens.noModelSelected.pleaseSelectAModel'),
  ).toBeTruthy();

  await act(async () => {
    appStateHandler('background');
  });
  await act(async () => {
    appStateHandler('active');
  });

  expect(mockDisposeChat).not.toHaveBeenCalled();
  expect(mockCreateChat).not.toHaveBeenCalled();
});
