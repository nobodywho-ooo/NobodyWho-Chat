import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { fireEvent, render, act } from '@testing-library/react-native';
import { Prompt } from 'react-native-nobodywho';
import { deleteAsync, getInfoAsync } from 'expo-file-system/legacy';

import { MessageListItem } from 'components';

import { InputBar } from '../components/InputBar/InputBar';
import { CameraCaptureModal } from '../components/CameraCaptureModal/CameraCaptureModal';
import { insertConversation, insertMessage } from 'repositories';
import { implicitThinkOpen } from 'helpers';
import type { ImplicitThinkOpen } from 'helpers';
import { Model, ModelPipeline } from 'types';
import {
  mockGetDocumentAsync,
  mockImageSaveAsync,
  mockLaunchImageLibraryAsync,
  mockClearCaches,
  mockKeyboardDismiss,
  mockListState,
  mockScrollToOffset,
  mockScrollToIndex,
} from 'jest/mock/node-modules';

import { ChatScreen } from '../ChatScreen';

const mockGetInfo = getInfoAsync as jest.Mock;
const mockUnlink = deleteAsync as jest.Mock;

// ChatScreen reads getAppState()/subscribeAppState() from the store and `chat`
// from the service; mock both so handleSend can run without the real model/db.
// getAppState must return a stable reference — useAppState() feeds it to
// useSyncExternalStore, which loops if the snapshot identity changes each call.
jest.mock('database', () => {
  const appState = { modelIdInUse: 0 };
  return {
    getAppState: jest.fn(() => appState),
    subscribeAppState: jest.fn(() => () => {}),
  };
});

const mockChat = {
  ask: jest.fn(),
  stopGeneration: jest.fn(),
  setChatHistory: jest.fn(),
  getChatHistory: jest.fn().mockResolvedValue([]),
};
// Stable ref (like the real AiService) so a test can swap chat.current mid-stream.
const mockChatRef: { current: typeof mockChat | undefined } = {
  current: mockChat,
};
// Drives which modalities ChatScreen offers for the loaded model.
let mockChatPipeline: ModelPipeline = ModelPipeline.textGeneration;
// Set when the loaded model's template prefills the opening reasoning tag.
let mockChatThinkOpen: ImplicitThinkOpen | undefined;
// Built once, not per useAiService() call: the real provider hands down slots
// whose identity is stable.
const mockSlots = {
  chat: {
    ref: mockChatRef,
    create: jest.fn(),
    dispose: jest.fn(),
    borrow: jest.fn(),
  },
  tts: {
    ref: { current: undefined },
    create: jest.fn(),
    dispose: jest.fn(),
    borrow: jest.fn(),
  },
  stt: {
    ref: { current: undefined },
    create: jest.fn(),
    dispose: jest.fn(),
    borrow: jest.fn(),
  },
  vad: {
    ref: { current: undefined },
    create: jest.fn(),
    dispose: jest.fn(),
    borrow: jest.fn(),
  },
};
jest.mock('services', () => ({
  useAiService: () => ({
    slots: mockSlots,
    chatPipeline: mockChatPipeline,
    chatThinkOpen: mockChatThinkOpen,
    ttsState: 'notLoaded',
  }),
  AiModelState: {
    NotLoaded: 'notLoaded',
    Loading: 'loading',
    Ready: 'ready',
    Error: 'error',
  },
  subscribeToolInvocations: jest.fn(() => jest.fn()),
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
  mockChatThinkOpen = undefined;
  mockChatRef.current = mockChat;
  mockChat.ask.mockReset().mockImplementation(() => stream());
  mockChatPipeline = ModelPipeline.textGeneration;
  mockLaunchImageLibraryAsync.mockReset().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///tmp/IMG_0001.jpg', fileName: 'IMG_0001.jpg' }],
  });
  mockGetDocumentAsync.mockReset().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///tmp/clip.mp3', name: 'clip.mp3' }],
  });
  mockImageSaveAsync.mockReset().mockResolvedValue({
    uri: 'file:///tmp/IMG_0111.png',
  });
  mockInsertConversation.mockReset().mockResolvedValue(42);
  // A written message resolves to its new id; the delete tests below switch it
  // to undefined, which is how the insert reports a vanished conversation.
  mockInsertMessage.mockReset().mockResolvedValue(1);
  mockGetInfo.mockReset().mockResolvedValue({ exists: false });
  mockUnlink.mockReset();
  mockClearCaches.mockReset();
  mockScrollToIndex.mockReset();
  mockScrollToOffset.mockReset();
  mockKeyboardDismiss.mockClear();
  mockListState.reset();
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
    expect.objectContaining({
      conversationId: 42,
      role: 'user',
      content: 'second',
    }),
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

test('a vision/hearing send attaches a picked image + audio as a Prompt', async () => {
  // An image+audio model is loaded, so both attach buttons are offered.
  mockChatPipeline = ModelPipeline.imageAudioTextToText;

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  // Pick an image and an audio file (pickers mocked), then send.
  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onAttachImage();
  });
  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onAttachAudio();
  });
  await send(screen, 'what is this');

  // The chat received a Prompt of text + image + audio parts, each pointing at
  // the persisted copy (under message-documents) with its extension preserved.
  expect(mockChat.ask).toHaveBeenCalledTimes(1);
  const promptArg = mockChat.ask.mock.calls[0][0];
  expect(promptArg).toBeInstanceOf(Prompt);
  expect(promptArg.parts).toEqual([
    { kind: 'text', content: 'what is this' },
    { kind: 'image', path: expect.stringContaining('IMG_0001') },
    { kind: 'audio', path: expect.stringContaining('clip') },
  ]);

  // The persisted user message records both document paths.
  const userCall = mockInsertMessage.mock.calls.find(
    ([m]) => m.role === 'user',
  );
  expect(userCall?.[0].documentsPath).toEqual([
    expect.stringContaining('IMG_0001'),
    expect.stringContaining('clip'),
  ]);
});

test('audio-only document picker restricts to audio MIME types', async () => {
  mockChatPipeline = ModelPipeline.audioTextToText;

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onAttachAudio();
  });
  await send(screen, 'what do you hear');

  // The picker was constrained to audio files.
  expect(mockGetDocumentAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      type: ['audio/mpeg', 'audio/wav', 'audio/x-wav'],
    }),
  );

  // The Prompt carries text + audio only — no image part.
  const promptArg = mockChat.ask.mock.calls[0][0];
  expect(promptArg).toBeInstanceOf(Prompt);
  expect(promptArg.parts).toEqual([
    { kind: 'text', content: 'what do you hear' },
    { kind: 'audio', path: expect.stringContaining('clip') },
  ]);

  // Only the audio path is persisted.
  const userCall = mockInsertMessage.mock.calls.find(
    ([m]) => m.role === 'user',
  );
  expect(userCall?.[0].documentsPath).toEqual([
    expect.stringContaining('clip'),
  ]);
});

test('an imported image is re-encoded to a compressed JPEG before attaching', async () => {
  mockChatPipeline = ModelPipeline.imageTextToText;
  mockLaunchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: 'file:///tmp/IMG_0111.heic',
        fileName: 'IMG_0111.heic',
        mimeType: 'image/heic',
      },
    ],
  });

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onAttachImage();
  });
  await send(screen, 'what is this');

  // Every image is re-encoded to a compressed JPEG (which also transcodes HEIC,
  // a format the loader can't decode), so the attached path is the .jpg, never
  // the .heic.
  expect(mockImageSaveAsync).toHaveBeenCalledWith(
    expect.objectContaining({ format: 'jpeg' }),
  );
  const promptArg = mockChat.ask.mock.calls[0][0];
  expect(promptArg.parts[1]).toEqual({
    kind: 'image',
    path: expect.stringContaining('.jpg'),
  });
  expect(promptArg.parts[1].path).not.toContain('.heic');
});

test('a photo captured from the camera is downscaled and attached as an image', async () => {
  mockChatPipeline = ModelPipeline.imageTextToText;

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  // Simulate the camera sheet returning a large captured photo.
  await act(async () => {
    await screen.UNSAFE_getByType(CameraCaptureModal as never).props.onCapture({
      uri: 'file:///tmp/CAPTURE_123.jpg',
      width: 4000,
      height: 3000,
    });
  });
  await send(screen, 'what is this');

  // It was re-encoded to a compressed JPEG (and resized, since it exceeded the
  // cap) and sent as an image part pointing at the persisted copy.
  expect(mockImageSaveAsync).toHaveBeenCalledWith(
    expect.objectContaining({ format: 'jpeg' }),
  );
  const promptArg = mockChat.ask.mock.calls[0][0];
  expect(promptArg).toBeInstanceOf(Prompt);
  expect(promptArg.parts).toEqual([
    { kind: 'text', content: 'what is this' },
    { kind: 'image', path: expect.stringContaining('CAPTURE_123') },
  ]);
});

test('deselecting an attached image deletes its unsent copy from disk', async () => {
  mockChatPipeline = ModelPipeline.imageTextToText;
  mockGetInfo.mockResolvedValue({ exists: true }); // the message-documents dir + copy exist

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );
  const bar = () => screen.UNSAFE_getByType(InputBar as never);

  // Attach (copies into message-documents), then tap again to deselect.
  await act(async () => {
    await bar().props.onAttachImage();
  });
  await act(async () => {
    await bar().props.onAttachImage();
  });

  // The orphaned copy (named from the picked IMG_0001) is unlinked, and nothing
  // is sent when the user then sends a plain-text message.
  expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('IMG_0001'), {
    idempotent: true,
  });
  await send(screen, 'never mind');
  expect(mockChat.ask).toHaveBeenCalledWith('never mind');
});

test('an unsent attachment is deleted when the screen unmounts', async () => {
  mockChatPipeline = ModelPipeline.imageTextToText;
  mockGetInfo.mockResolvedValue({ exists: true });

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onAttachImage();
  });
  await act(async () => {
    screen.unmount();
  });

  expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('IMG_0001'), {
    idempotent: true,
  });
});

test('a sent attachment is NOT deleted on unmount (the message owns it)', async () => {
  mockChatPipeline = ModelPipeline.imageTextToText;
  mockGetInfo.mockResolvedValue({ exists: true });

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onAttachImage();
  });
  await send(screen, 'what is this');
  mockUnlink.mockClear();
  await act(async () => {
    screen.unmount();
  });

  // The image was sent (persisted into the message), so its copy survives.
  expect(mockUnlink).not.toHaveBeenCalled();
});

test('cancelling the image picker attaches nothing', async () => {
  mockChatPipeline = ModelPipeline.imageTextToText;
  mockLaunchImageLibraryAsync.mockResolvedValue({
    canceled: true,
    assets: null,
  });

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onAttachImage();
  });
  await send(screen, 'hello');

  // A bare string prompt and no document paths persisted.
  expect(mockChat.ask).toHaveBeenCalledWith('hello');
  const userCall = mockInsertMessage.mock.calls.find(
    ([m]) => m.role === 'user',
  );
  expect(userCall?.[0].documentsPath).toEqual([]);
});

test('a failing image picker alerts with the error and attaches nothing', async () => {
  mockChatPipeline = ModelPipeline.imageTextToText;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockLaunchImageLibraryAsync.mockRejectedValue(new Error('no photo access'));

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onAttachImage();
  });

  expect(alert).toHaveBeenCalledWith(
    'common.somethingWentWrong',
    'screens.chat.attachmentFailedMessage',
  );

  // The failure is surfaced, not attached: the send stays a bare text prompt.
  await send(screen, 'hello');
  expect(mockChat.ask).toHaveBeenCalledWith('hello');
  alert.mockRestore();
});

test('a plain text send carries no documents even when multimodal is ready', async () => {
  // Multimodal model loaded, but the user never tapped attach.
  mockChatPipeline = ModelPipeline.imageAudioTextToText;

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'just text');

  // A bare string prompt, not a Prompt, and no document paths persisted.
  expect(mockChat.ask).toHaveBeenCalledWith('just text');
  const userCall = mockInsertMessage.mock.calls.find(
    ([m]) => m.role === 'user',
  );
  expect(userCall?.[0].documentsPath).toEqual([]);
});

test('a model swap mid-stream stops streaming without persisting the assistant', async () => {
  // Simulate the chat slot being disposed — its ref nulled — after the first token.
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

test('stopping mid-stream persists the partial answer and a "stopped" system message', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );
  // The user taps Stop right after the first token streams in.
  mockChat.ask.mockImplementation(() =>
    (async function* () {
      yield 'partial';
      screen.UNSAFE_getByType(InputBar as never).props.onStop();
    })(),
  );

  await send(screen, 'hi');

  const roles = mockInsertMessage.mock.calls.map(([m]) => m.role);
  expect(roles).toEqual(['user', 'assistant', 'system']);
  const systemCall = mockInsertMessage.mock.calls.find(
    ([m]) => m.role === 'system',
  );
  expect(systemCall?.[0]).toMatchObject({
    role: 'system',
    content: 'screens.chat.generationStopped',
  });
});

test('a generation error persists the partial answer and a "failed" system message', async () => {
  mockChat.ask.mockImplementation(() =>
    (async function* () {
      yield 'partial';
      throw new Error('boom');
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

  const systemCall = mockInsertMessage.mock.calls.find(
    ([m]) => m.role === 'system',
  );
  expect(systemCall?.[0]).toMatchObject({
    role: 'system',
    content: 'screens.chat.generationFailed',
  });
});

// Delete Chat halts generation and deletes the conversation without waiting for
// the turn to settle (see DrawerNavigator), so the rest of a turn can run with
// its conversation already gone. insertMessage guards itself on the parent row
// with an EXISTS, so a vanished conversation resolves to undefined instead of
// raising the `FOREIGN KEY constraint failed` an unguarded insert would.
const deleteConversationMidStream = () => {
  mockInsertMessage.mockResolvedValue(undefined);
};

// Which writes actually landed. Every write is still attempted after a delete —
// the attempt is what discovers the row is gone — so asking whether
// insertMessage was called no longer says whether anything was stored. A call
// resolving to undefined hit the EXISTS guard and wrote nothing.
const persistedRoles = async (): Promise<string[]> => {
  const ids = await Promise.all(
    mockInsertMessage.mock.results.map(result => result.value),
  );
  return ids.flatMap((id, i) =>
    id === undefined ? [] : [mockInsertMessage.mock.calls[i][0].role],
  );
};

test('a delete mid-stream drops the answer instead of writing it into rows that are gone', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );
  mockChat.ask.mockImplementation(() =>
    (async function* () {
      yield 'partial';
      deleteConversationMidStream();
    })(),
  );

  // A throw here would escape handleSend, which nothing awaits in the app.
  await send(screen, 'hi');

  // Only the user message, written before the delete, made it to the database.
  expect(await persistedRoles()).toEqual(['user']);
  // And the turn released the input bar rather than leaving it mid-answer.
  expect(screen.UNSAFE_getByType(InputBar as never).props.isStreaming).toBe(
    false,
  );
});

test('a delete after Stop leaves no "stopped" note behind', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );
  mockChat.ask.mockImplementation(() =>
    (async function* () {
      yield 'partial';
      screen.UNSAFE_getByType(InputBar as never).props.onStop();
      deleteConversationMidStream();
    })(),
  );

  await send(screen, 'hi');

  // The note belongs to a conversation that no longer exists, so it is neither
  // persisted nor appended to the chat that replaced it on screen.
  expect(await persistedRoles()).not.toContain('system');
  expect(screen.queryByText('screens.chat.generationStopped')).toBeNull();
});

test('a conversation deleted before the first write is never asked for an answer', async () => {
  deleteConversationMidStream();

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'hi');

  // The question is attempted — that attempt is what discovers the row is gone
  // — but it stores nothing, and nothing follows it.
  expect(mockInsertMessage).toHaveBeenCalledTimes(1);
  expect(await persistedRoles()).toEqual([]);
  // Nothing could hold the answer, so the model is not put to work for it.
  expect(mockChat.ask).not.toHaveBeenCalled();
  expect(screen.UNSAFE_getByType(InputBar as never).props.isStreaming).toBe(
    false,
  );
});

test('a model deleted before the first send drops the turn instead of stranding it', async () => {
  // conversations.model_id is a foreign key, and modelIdInUse can outlive the
  // row it names (a delete that fails part-way leaves it dangling until the
  // next launch sweeps it). insertConversation guards on the model still
  // existing, so it resolves to undefined here rather than raising
  // `FOREIGN KEY constraint failed` out of a handleSend nothing awaits.
  mockInsertConversation.mockResolvedValue(undefined);
  const onConversationCreated = jest.fn();

  const screen = render(
    <ChatScreen
      conversationId={undefined}
      messages={[]}
      onConversationCreated={onConversationCreated}
    />,
  );

  await send(screen, 'hi');

  expect(mockInsertMessage).not.toHaveBeenCalled();
  expect(mockChat.ask).not.toHaveBeenCalled();
  expect(onConversationCreated).not.toHaveBeenCalled();
  // The optimistic question and its empty answer are taken back off screen,
  // and the input bar is released rather than left mid-answer forever.
  expect(screen.queryByText('hi')).toBeNull();
  expect(screen.UNSAFE_getByType(InputBar as never).props.isStreaming).toBe(
    false,
  );
});

test('a persistence failure that is not a delete still finishes the turn', async () => {
  // A write can fail with the conversation intact (a closed database on the way
  // to the background, a full disk). The answer stays on screen and the turn
  // ends normally instead of the failure cascading out of handleSend.
  mockInsertMessage.mockRejectedValue(new Error('disk I/O error'));

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'hi');

  const items = screen.UNSAFE_getAllByType(MessageListItem);
  expect(items[items.length - 1].props.message.content).toBe('Hello world');
  expect(screen.UNSAFE_getByType(InputBar as never).props.isStreaming).toBe(
    false,
  );
});

test('puts the keyboard away when a message is sent', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  expect(mockKeyboardDismiss).not.toHaveBeenCalled();

  await send(screen, 'hi');

  // The answer is about to take over the screen, so the keyboard goes away as
  // part of sending rather than as a side effect of whatever scrolls next.
  expect(mockKeyboardDismiss).toHaveBeenCalled();
});

test('leaves the keyboard alone when there is nothing to send', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onSend();
  });

  expect(mockKeyboardDismiss).not.toHaveBeenCalled();
});

// --- Anchoring the sent message --------------------------------------------

// The legend-list mock hangs the anchoring props on a `LegendList` wrapper.
const listProps = (screen: ReturnType<typeof render>) =>
  screen.UNSAFE_getByType('LegendList' as never).props;

test('sending anchors the new message and rides it to the top', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'hi');

  // The user message landed at index 0, so that row is the one held at the top,
  // with blank space reserved below it for the reply.
  expect(listProps(screen).anchoredEndSpace).toEqual(
    expect.objectContaining({ anchorIndex: 0 }),
  );
  // The scroll targets the row itself, not the end of the content: the end
  // moves as the reserved space shrinks and as the composer's inset drops when
  // the field snaps back to one line, and a list pinned there goes with it.
  // The first message of a conversation jumps: there is nothing to slide past.
  expect(mockScrollToIndex).toHaveBeenCalledWith({
    index: 0,
    viewPosition: 0,
    viewOffset: 12,
    animated: false,
  });
});

test('a later send anchors that message and animates the ride up', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'answer' },
      ]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'second');

  expect(listProps(screen).anchoredEndSpace).toEqual(
    expect.objectContaining({ anchorIndex: 2 }),
  );
  expect(mockScrollToIndex).toHaveBeenCalledWith({
    index: 2,
    viewPosition: 0,
    viewOffset: 12,
    animated: true,
  });
});

test('a message with an attachment anchors uncapped', async () => {
  mockChatPipeline = ModelPipeline.imageAudioTextToText;

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await act(async () => {
    await screen.UNSAFE_getByType(InputBar as never).props.onAttachImage();
  });
  await send(screen, 'what is this');

  // An image row is taller than the text cap; capping it would park the middle
  // of the picture at the top instead of its edge.
  expect(listProps(screen).anchoredEndSpace.anchorMaxSize).toBeUndefined();
});

test('a new chat getting its id mid-turn leaves the anchor alone', async () => {
  const screen = render(
    <ChatScreen
      conversationId={undefined}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'hi');
  expect(listProps(screen).anchoredEndSpace).toEqual(
    expect.objectContaining({ anchorIndex: 0 }),
  );
  mockScrollToIndex.mockClear();
  mockScrollToOffset.mockClear();
  mockClearCaches.mockClear();

  // The send created the conversation, so its id reaches this screen a beat
  // later — while the answer is still streaming in. Reading that as a switch
  // drops the anchor and throws away the measured row heights underneath a
  // live turn, and the conversation visibly falls and jumps back.
  screen.update(
    <ChatScreen
      conversationId={42}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  expect(listProps(screen).anchoredEndSpace).toEqual(
    expect.objectContaining({ anchorIndex: 0 }),
  );
  expect(mockClearCaches).not.toHaveBeenCalled();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
  expect(mockScrollToIndex).not.toHaveBeenCalled();
});

test('switching conversation drops the anchor and jumps to the latest message', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'hi');
  expect(listProps(screen).anchoredEndSpace).toBeDefined();

  screen.update(
    <ChatScreen
      conversationId={9}
      messages={[{ role: 'user', content: 'another chat' }]}
      onConversationCreated={jest.fn()}
    />,
  );

  // Another conversation's history has no turn in flight to anchor, and it
  // opens on its last message rather than wherever the anchor had parked.
  expect(listProps(screen).anchoredEndSpace).toBeUndefined();
  expect(mockScrollToOffset).toHaveBeenCalledWith(
    expect.objectContaining({ animated: false }),
  );
  // Rows are keyed by index, so the outgoing conversation's measured heights
  // would otherwise be reused for the incoming one's rows.
  expect(mockClearCaches).toHaveBeenCalledWith({ mode: 'sizes' });
});

// --- Scroll-to-bottom chevron ----------------------------------------------

const chevron = (screen: ReturnType<typeof render>) =>
  screen.queryByLabelText('components.scrollToBottomButton.label');

test('offers the chevron only while the end of the conversation is out of view', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'hi');

  // Sitting at the end: nothing to scroll down to.
  expect(chevron(screen)).toBeNull();

  act(() => mockListState.emitIsAtEnd(false));
  expect(chevron(screen)).toBeTruthy();

  act(() => mockListState.emitIsAtEnd(true));
  expect(chevron(screen)).toBeNull();
});

test('the chevron does not flash while the list is still settling', async () => {
  const screen = render(
    <ChatScreen
      conversationId={undefined}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  // The list mounts with the first message and reports "not at the end" until
  // it has laid out and run its scroll. Believing a reading taken right then
  // flashes the chevron over the first message of every new conversation, so
  // only the signal itself is trusted.
  mockListState.isAtEnd = false;
  await send(screen, 'hi');

  expect(chevron(screen)).toBeNull();
});

test('the chevron is never offered on an empty conversation', () => {
  const screen = render(
    <ChatScreen
      conversationId={undefined}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  act(() => mockListState.emitIsAtEnd(false));
  expect(chevron(screen)).toBeNull();
});

test('follows the answer only while the reader has asked it to', async () => {
  // A stream the test advances one token at a time, so the list can be poked
  // between them.
  const gates = ['one', ' two', ' three'].map(token => {
    let release = () => {};
    const arrived = new Promise<void>(resolve => {
      release = resolve;
    });
    return { token, arrived, release };
  });
  mockChat.ask.mockImplementation(async function* () {
    for (const gate of gates) {
      await gate.arrived;
      yield gate.token;
    }
  });
  const nextToken = async (index: number) => {
    await act(async () => {
      gates[index].release();
    });
  };

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  const bar = screen.UNSAFE_getByType(InputBar as never);
  act(() => bar.props.onChangeText('hi'));
  let turn: Promise<void> | undefined;
  await act(async () => {
    turn = screen.UNSAFE_getByType(InputBar as never).props.onSend();
  });

  // Nothing follows on its own: the sent message stays anchored where the
  // reader can read it, however much answer arrives underneath. (The mount's
  // own jump to the latest message already happened, hence the clear.)
  mockScrollToOffset.mockClear();
  await nextToken(0);
  expect(mockScrollToOffset).not.toHaveBeenCalled();
  expect(listProps(screen).anchoredEndSpace).toBeDefined();

  // They ask for the bottom. That lets the anchor go — while it holds, blank
  // space is reserved below the answer and the end of the list is the end of
  // that space rather than the newest token.
  act(() => mockListState.emitIsAtEnd(false));
  fireEvent.press(chevron(screen)!);
  expect(listProps(screen).anchoredEndSpace).toBeUndefined();

  // From here each token walks the tail along, animated, rather than the list
  // snapping once enough of the answer has piled up.
  // Not animated: an animated scroll per token never catches the text, and the
  // backlog unwinds in a rush the moment generation stops.
  await nextToken(1);
  expect(mockScrollToOffset).toHaveBeenCalledWith(
    expect.objectContaining({ animated: false }),
  );

  // While following there is nothing to offer: the reader is being held at the
  // bottom, and the end drifts out of view for a frame on every token.
  act(() => mockListState.emitIsAtEnd(false));
  expect(chevron(screen)).toBeNull();

  // Touching the conversation hands scrolling back to them, and the tokens
  // that follow leave it where they put it.
  act(() =>
    screen.UNSAFE_getByType(ScrollView as never).props.onScrollBeginDrag(),
  );
  act(() => mockListState.emitIsAtEnd(false));
  expect(chevron(screen)).toBeTruthy();

  mockScrollToOffset.mockClear();
  await act(async () => {
    gates[2].release();
    await turn;
  });
  expect(mockScrollToOffset).not.toHaveBeenCalled();
});

test('pressing the chevron scrolls the conversation to its end', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'hi');
  act(() => mockListState.emitIsAtEnd(false));

  fireEvent.press(chevron(screen)!);

  // Animated, and aimed at an offset past the bottom rather than at "the end":
  // the list works the end out from the last row's measured size, which trails
  // the text while an answer is being written.
  expect(mockScrollToOffset).toHaveBeenCalledWith(
    expect.objectContaining({ animated: true }),
  );
  // The reader is at the bottom now, so there is nothing left to offer them.
  expect(chevron(screen)).toBeNull();
});

test('a turn that grows after its last token keeps its end in view', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'hi');
  act(() => mockListState.emitIsAtEnd(false));
  fireEvent.press(chevron(screen)!);

  // The finished answer is taller than the last token left it: the footer row
  // under it — copy, speak, the metrics — arrives with the end of the turn, and
  // the list only learns its height when it measures the row. Aiming at the end
  // again from the render that added it lands short, so the list's own report of
  // what it measured is what puts the reader back at the bottom.
  mockScrollToOffset.mockClear();
  act(() => mockListState.emitTotalSize(1200));

  expect(mockScrollToOffset).toHaveBeenCalledWith(
    expect.objectContaining({ animated: false }),
  );
});

test('content measured after the reader has taken over leaves them where they are', async () => {
  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );

  await send(screen, 'hi');
  act(() => mockListState.emitIsAtEnd(false));
  fireEvent.press(chevron(screen)!);
  act(() =>
    screen.UNSAFE_getByType(ScrollView as never).props.onScrollBeginDrag(),
  );

  mockScrollToOffset.mockClear();
  act(() => mockListState.emitTotalSize(1200));

  expect(mockScrollToOffset).not.toHaveBeenCalled();
});

test('stopping mid-thinking keeps the block open for a template-opened model', () => {
  // The model only ever emits the closing tag, so the opener is written into
  // the stream. Stopping before it closes must not strip that opener, or the
  // reasoning reloads as the answer itself.
  mockChatThinkOpen = implicitThinkOpen(
    { family: 'NeoHorse 1', parameterCountBillions: 4 } as Model,
    true,
  );

  const screen = render(
    <ChatScreen
      conversationId={7}
      messages={[]}
      onConversationCreated={jest.fn()}
    />,
  );
  mockChat.ask.mockImplementation(() =>
    (async function* () {
      yield 'I was working out that';
      screen.UNSAFE_getByType(InputBar as never).props.onStop();
    })(),
  );

  return send(screen, 'hi').then(() => {
    const assistant = mockInsertMessage.mock.calls
      .map(([message]) => message)
      .find(message => message.role === 'assistant');

    expect(assistant.content).toBe('<think>I was working out that');
  });
});
