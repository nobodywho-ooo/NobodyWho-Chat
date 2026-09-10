import React from 'react';
import { Alert } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { Prompt } from 'react-native-nobodywho';
import { deleteAsync, getInfoAsync } from 'expo-file-system/legacy';

import { MessageListItem } from 'components';

import { InputBar } from '../components/InputBar/InputBar';
import { CameraCaptureModal } from '../components/CameraCaptureModal/CameraCaptureModal';
import { insertConversation, insertMessage } from 'repositories';
import { ModelPipeline } from 'types';
import {
  mockGetDocumentAsync,
  mockImageSaveAsync,
  mockLaunchImageLibraryAsync,
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
jest.mock('services', () => ({
  useAiService: () => ({
    chat: mockChatRef,
    chatPipeline: mockChatPipeline,
    tts: { current: undefined },
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
  const userCall = mockInsertMessage.mock.calls.find(([m]) => m.role === 'user');
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
  const userCall = mockInsertMessage.mock.calls.find(([m]) => m.role === 'user');
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
  expect(mockUnlink).toHaveBeenCalledWith(
    expect.stringContaining('IMG_0001'),
    { idempotent: true },
  );
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

  expect(mockUnlink).toHaveBeenCalledWith(
    expect.stringContaining('IMG_0001'),
    { idempotent: true },
  );
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
  mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

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
  const userCall = mockInsertMessage.mock.calls.find(([m]) => m.role === 'user');
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
  const userCall = mockInsertMessage.mock.calls.find(([m]) => m.role === 'user');
  expect(userCall?.[0].documentsPath).toEqual([]);
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
  const systemCall = mockInsertMessage.mock.calls.find(([m]) => m.role === 'system');
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

  const systemCall = mockInsertMessage.mock.calls.find(([m]) => m.role === 'system');
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
