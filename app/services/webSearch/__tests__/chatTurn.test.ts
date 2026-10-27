import type { Chat } from 'react-native-nobodywho';
import type { Model } from 'types';

import {
  prepareWebSearchTurn,
  restoreChatForTurn,
  restoreWebSearchTurn,
} from '../chatTurn';
import { runWebSearch } from '../runWebSearch';
import { useWebSearchStore } from '../webSearchStore';

jest.mock('../runWebSearch', () => ({ runWebSearch: jest.fn() }));
jest.mock('../scrape/webViewScrapeProvider', () => ({
  webViewScrapeProvider: { releaseHost: jest.fn() },
}));
jest.mock('helpers', () => ({
  log: jest.fn(),
  deviceRamGB: jest.fn(async () => 8),
  modelRequiredMemoryGB: (model: { sizeGB?: number }) => model.sizeGB ?? 0,
}));

const runWebSearchMock = runWebSearch as jest.Mock;

const telemetry = {
  needsSearch: true,
  intent: 'Paris weather tomorrow',
  intentKind: 'fact',
  plannedQueries: ['Paris weather tomorrow'],
  rounds: [],
  providerCalls: 1,
  enginesTried: ['ddg-html'],
  finalConfidence: 0.8,
  finalLabel: 'correct',
  agreement: {
    independentHosts: 1,
    repeatedHostResults: 0,
    corroborated: [],
    singleSourced: [],
    agreementRatio: 0,
  },
  fetchFailures: [],
  recovery: [],
};

const chatModel: Model = {
  id: 1,
  name: 'Qwen3',
  sizeGB: 2.5,
  parameterCountBillions: 4,
  author: 'qwen',
  family: 'qwen3',
  thinking: true,
  toolCalling: false,
  huggingfaceUrl: '',
  parts: [],
  pipeline: 'textGeneration' as Model['pipeline'],
  tags: [],
  languages: [],
  supportedFileFormat: [],
};

const tokens = async function* (...parts: string[]) {
  for (const part of parts) {
    yield part;
  }
};

const makeChat = (overrides: Record<string, unknown> = {}) =>
  ({
    getChatHistory: jest.fn(async () => [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
    ]),
    getSystemPrompt: jest.fn(async () => 'You are helpful.'),
    getTemplateVariables: jest.fn(async () => ({ enable_thinking: true })),
    getStats: jest.fn(async () => ({ contextSize: 8192, contextUsed: 200 })),
    complete: jest.fn(() => tokens('{"needs_search": true}')),
    setSystemPrompt: jest.fn(async () => undefined),
    setChatHistory: jest.fn(async () => undefined),
    stopGeneration: jest.fn(),
    ...overrides,
  }) as unknown as Chat & Record<string, jest.Mock>;

const embeddingSlot = {
  create: jest.fn(async () => true),
  dispose: jest.fn(),
  borrow: jest.fn(),
};

const prepare = (chat: Chat, extra: Record<string, unknown> = {}) =>
  prepareWebSearchTurn({
    chat,
    question: 'Weather in Paris tomorrow?',
    chatModel,
    embeddingSlot,
    signal: new AbortController().signal,
    ...extra,
  });

beforeEach(() => {
  runWebSearchMock.mockReset();
  embeddingSlot.create.mockClear();
  useWebSearchStore.setState({ notice: null, isSearchingWeb: false });
});

describe('prepareWebSearchTurn', () => {
  it('returns the grounded prompt and the sources found', async () => {
    runWebSearchMock.mockResolvedValue({
      context: [
        '\n --- Source 1: Paris forecast --- \n Tomorrow: 18°C. \n --- End of Source 1 ---',
      ],
      sourceDocuments: [
        {
          kind: 'web',
          name: 'Paris forecast',
          url: 'https://w.example/paris',
          passage: 'Tomorrow: 18°C.',
          used: true,
          read: true,
        },
      ],
      telemetry,
    });
    const chat = makeChat();

    const turn = await prepare(chat);

    expect(turn?.prompt).toContain('<sources>');
    expect(turn?.prompt).toContain('Weather in Paris tomorrow?');
    expect(turn?.sources).toEqual([
      {
        name: 'Paris forecast',
        url: 'https://w.example/paris',
        passage: 'Tomorrow: 18°C.',
        used: true,
        read: true,
      },
    ]);
    expect(turn?.snapshot.systemPrompt).toBe('You are helpful.');
    expect(useWebSearchStore.getState().isSearchingWeb).toBe(false);
  });

  it('hands the planner the conversation so far and the remaining budget', async () => {
    runWebSearchMock.mockResolvedValue({
      context: [],
      sourceDocuments: [],
      telemetry: { ...telemetry, needsSearch: false, skippedReason: 'gated' },
    });

    await prepare(makeChat());

    const input = runWebSearchMock.mock.calls[0][0];
    expect(input.query).toBe('Weather in Paris tomorrow?');
    expect(input.history).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
    ]);
    expect(input.contextCharBudget).toBeGreaterThan(0);
    expect(input.profile.webPlanner).toBe('llm');
    expect(input.embeddings).toBeNull();
  });

  it('marks the chat borrowed once the planner ran a completion, with thinking off', async () => {
    runWebSearchMock.mockImplementation(async ({ generate }) => {
      await generate([
        { role: 'system', content: 'plan' },
        { role: 'user', content: 'Weather in Paris tomorrow?' },
      ]);
      return { context: [], sourceDocuments: [], telemetry };
    });
    const chat = makeChat();

    const turn = await prepare(chat);

    expect(turn?.chatWasBorrowed).toBe(true);
    expect(chat.complete).toHaveBeenCalledWith(
      [
        { role: 'system', content: 'plan' },
        { role: 'user', content: 'Weather in Paris tomorrow?' },
      ],
      { templateVariables: { enable_thinking: false } },
    );
  });

  it('tells the model not to guess, and says so, when the search found nothing', async () => {
    runWebSearchMock.mockResolvedValue({
      context: [],
      sourceDocuments: [],
      telemetry,
    });

    const turn = await prepare(makeChat());

    expect(turn?.prompt).toContain('found nothing usable');
    expect(useWebSearchStore.getState().notice?.kind).toBe('nothingFound');
  });

  it('skips the search when the context has no room left', async () => {
    const chat = makeChat({
      getStats: jest.fn(async () => ({ contextSize: 2048, contextUsed: 1900 })),
    });

    const turn = await prepare(chat);

    expect(turn).toBeUndefined();
    expect(runWebSearchMock).not.toHaveBeenCalled();
    expect(useWebSearchStore.getState().notice?.kind).toBe('noRoom');
  });

  it('loads the embedding model only for the retrieval', async () => {
    runWebSearchMock.mockImplementation(async ({ embeddings }) => {
      await embeddings.runWithLoadedModel(async () => undefined);
      return { context: [], sourceDocuments: [], telemetry };
    });
    const embeddingModel = {
      ...chatModel,
      id: 9,
      family: 'embeddinggemma',
      sizeGB: 0.3,
      pipeline: 'featureExtraction' as Model['pipeline'],
    };

    await prepare(makeChat(), { embeddingModel });

    expect(embeddingSlot.create).toHaveBeenCalledWith({
      model: embeddingModel,
    });
    expect(embeddingSlot.dispose).toHaveBeenCalled();
  });
});

describe('restoreWebSearchTurn', () => {
  it('puts the plain question back in place of the grounded one', async () => {
    const chat = makeChat({
      getChatHistory: jest.fn(async () => [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'SOURCES… Weather?' },
        { role: 'assistant', content: 'Rain.' },
      ]),
    });

    await restoreWebSearchTurn(chat, 'SOURCES… Weather?', 'Weather?');

    expect(chat.setChatHistory).toHaveBeenCalledWith([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
      { role: 'user', content: 'Weather?' },
      { role: 'assistant', content: 'Rain.' },
    ]);
  });

  it('leaves the history alone when nothing was swapped in', async () => {
    const chat = makeChat();

    await restoreWebSearchTurn(chat, 'Weather?', 'Weather?');
    await restoreWebSearchTurn(chat, 'not in history', 'Weather?');

    expect(chat.setChatHistory).not.toHaveBeenCalled();
  });
});

describe('restoreChatForTurn', () => {
  it('puts the system prompt the planner replaced back', async () => {
    const chat = makeChat();

    await restoreChatForTurn(chat, {
      history: [],
      systemPrompt: 'You are helpful.',
      templateVariables: {},
    });

    expect(chat.setSystemPrompt).toHaveBeenCalledWith('You are helpful.');
  });
});
