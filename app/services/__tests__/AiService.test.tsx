import React from 'react';
import { renderHook, act } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';
import { mockFromPath } from 'jest/mock/node-modules';

import { AiServiceProvider, useAiService, AiModelState } from '../AiService';

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

const model = buildModel(1, {
  downloadLinks: [
    { url: 'file://model.gguf', fileName: 'model.gguf', type: 'model' },
  ],
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AiServiceProvider>{children}</AiServiceProvider>
);

beforeEach(() => {
  mockFromPath.mockReset();
});

test('createChat loads the model and exposes the chat', async () => {
  const chat = { destroy: jest.fn() };
  mockFromPath.mockResolvedValue(chat);
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await result.current.createChat({ model });
  });

  expect(mockFromPath).toHaveBeenCalledWith(
    expect.objectContaining({ modelPath: 'file://model.gguf' }),
  );
  expect(result.current.chatState).toBe(AiModelState.Ready);
  expect(result.current.chat.current).toBe(chat);
});

test('createChat sets the error state and rethrows on failure', async () => {
  mockFromPath.mockRejectedValue(new Error('load boom'));
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await expect(result.current.createChat({ model })).rejects.toThrow(
      'load boom',
    );
  });

  expect(result.current.chatState).toBe(AiModelState.Error);
  expect(result.current.chat.current).toBeUndefined();
});

test('disposeChat destroys the current chat instance', async () => {
  const chat = { destroy: jest.fn() };
  mockFromPath.mockResolvedValue(chat);
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.createChat({ model });
  });

  act(() => result.current.disposeChat());

  expect(chat.destroy).toHaveBeenCalledTimes(1);
  expect(result.current.chat.current).toBeUndefined();
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);
});

test('a chat resolving after disposeChat is discarded and destroyed', async () => {
  let resolveFromPath: (chat: unknown) => void;
  mockFromPath.mockReturnValue(
    new Promise(resolve => {
      resolveFromPath = resolve;
    }),
  );
  const { result } = renderHook(() => useAiService(), { wrapper });

  let createPromise: Promise<void> | undefined;
  act(() => {
    createPromise = result.current.createChat({ model });
  });
  act(() => result.current.disposeChat());

  const staleChat = { destroy: jest.fn() };
  await act(async () => {
    resolveFromPath!(staleChat);
    await createPromise;
  });

  expect(staleChat.destroy).toHaveBeenCalledTimes(1);
  expect(result.current.chat.current).toBeUndefined();
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);
});
