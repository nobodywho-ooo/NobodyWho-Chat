import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Prompt } from 'react-native-nobodywho';
import { exists, unlink } from '@dr.pogodin/react-native-fs';

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

const mockExists = exists as jest.Mock;
const mockUnlink = unlink as jest.Mock;

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
const mockChatRef: { current: typeof mockChat | undefined } = {
  current: mockChat,
};
// Drives which modalities ChatScreen offers for the loaded model.
let mockChatPipeline: ModelPipeline = ModelPipeline.textGeneration;
jest.mock('services', () => ({
  useAiService: () => ({
    chat: mockChatRef,
    chatPipeline: mockChatPipeline,
  }),
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
  mockInsertMessage.mockReset().mockResolvedValue(1);
  mockExists.mockReset();
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
  mockExists.mockResolvedValue(true); // the message-documents dir + copy exist

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
  expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('IMG_0001'));
  await send(screen, 'never mind');
  expect(mockChat.ask).toHaveBeenCalledWith('never mind');
});

test('an unsent attachment is deleted when the screen unmounts', async () => {
  mockChatPipeline = ModelPipeline.imageTextToText;
  mockExists.mockResolvedValue(true);

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

  expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('IMG_0001'));
});

test('a sent attachment is NOT deleted on unmount (the message owns it)', async () => {
  mockChatPipeline = ModelPipeline.imageTextToText;
  mockExists.mockResolvedValue(true);

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
