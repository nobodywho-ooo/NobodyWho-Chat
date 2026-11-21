import { act, renderHook } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';

import { useWebSearchToggle } from '../hooks/useWebSearchToggle';

const mockChatModel = buildModel(1, { pipeline: ModelPipeline.textGeneration });
const mockEmbeddingModel = buildModel(2, {
  pipeline: ModelPipeline.featureExtraction,
});

let mockSlotEmbedding: typeof mockEmbeddingModel | undefined;
let mockInstalled: (typeof mockChatModel)[] = [];
const mockIsHighMemoryDevice = jest.fn(() => false);
const mockIsMemoryConstrained = jest.fn(() => false);

jest.mock('hooks', () => ({
  useSlotModel: (slot: string) =>
    slot === 'embedding' ? mockSlotEmbedding : mockChatModel,
  useModels: () => ({ models: mockInstalled, loading: false }),
}));

jest.mock('helpers', () => ({
  deviceRamGB: () => Promise.resolve(12),
  log: jest.fn(),
}));

jest.mock('services', () => {
  const { useWebSearchStore, NEW_CHAT_KEY } = jest.requireActual(
    'services/webSearch/webSearchStore',
  );
  return {
    useAiService: () => ({ slots: { embedding: {} } }),
    useWebSearchStore,
    NEW_CHAT_KEY,
    hasMemoryForWebSearch: () => true,
    isWebSearchReady: () => true,
    isHighMemoryDevice: () => mockIsHighMemoryDevice(),
    isMemoryConstrained: () => mockIsMemoryConstrained(),
  };
});

const { useWebSearchStore } = jest.requireActual(
  'services/webSearch/webSearchStore',
);

const CONVERSATION_ID = 7;

const isSearchOn = (): boolean =>
  useWebSearchStore.getState().enabledByChat[CONVERSATION_ID] ?? false;

const renderToggle = async () => {
  const hook = await renderHook(() => useWebSearchToggle(CONVERSATION_ID));
  // Let deviceRamGB resolve
  await act(async () => {});
  return hook;
};

beforeEach(() => {
  mockSlotEmbedding = undefined;
  mockInstalled = [mockChatModel];
  mockIsHighMemoryDevice.mockReturnValue(false);
  mockIsMemoryConstrained.mockReturnValue(false);
  useWebSearchStore.getState().setEnabled(CONVERSATION_ID, false);
});

test('turning search on without an embedding model opens the prompt', async () => {
  const { result } = await renderToggle();

  await act(async () => result.current.toggle());

  expect(isSearchOn()).toBe(true);
  expect(result.current.embeddingPrompt).toMatchObject({
    open: true,
    required: false,
  });
});

test('an embedding model already in use never opens the prompt', async () => {
  mockSlotEmbedding = mockEmbeddingModel;
  mockInstalled = [mockChatModel, mockEmbeddingModel];
  const { result } = await renderToggle();

  await act(async () => result.current.toggle());

  expect(result.current.embeddingPrompt.open).toBe(false);
});

test('an embedding model downloaded but not in use never opens the prompt', async () => {
  mockInstalled = [mockChatModel, mockEmbeddingModel];
  const { result } = await renderToggle();

  await act(async () => result.current.toggle());

  expect(isSearchOn()).toBe(true);
  expect(result.current.embeddingPrompt.open).toBe(false);
});

test('a memory-constrained phone is never asked', async () => {
  mockIsMemoryConstrained.mockReturnValue(true);
  const { result } = await renderToggle();

  await act(async () => result.current.toggle());

  expect(result.current.embeddingPrompt.open).toBe(false);
});

test('dismissing the optional prompt keeps search on and does not ask again', async () => {
  const { result } = await renderToggle();

  await act(async () => result.current.toggle());
  await act(async () => result.current.embeddingPrompt.close('dismissed'));

  expect(isSearchOn()).toBe(true);
  expect(result.current.embeddingPrompt.open).toBe(false);

  // Off and on again: not asked a second time on this screen
  await act(async () => result.current.toggle());
  await act(async () => result.current.toggle());

  expect(result.current.embeddingPrompt.open).toBe(false);
});

test('dismissing the required prompt turns search back off', async () => {
  mockIsHighMemoryDevice.mockReturnValue(true);
  const { result } = await renderToggle();

  await act(async () => result.current.toggle());

  expect(result.current.embeddingPrompt.required).toBe(true);

  await act(async () => result.current.embeddingPrompt.close('dismissed'));

  expect(isSearchOn()).toBe(false);
});

test('a prompt that ends with the model ready keeps search on', async () => {
  mockIsHighMemoryDevice.mockReturnValue(true);
  const { result } = await renderToggle();

  await act(async () => result.current.toggle());
  await act(async () => result.current.embeddingPrompt.close('ready'));

  expect(isSearchOn()).toBe(true);
});
