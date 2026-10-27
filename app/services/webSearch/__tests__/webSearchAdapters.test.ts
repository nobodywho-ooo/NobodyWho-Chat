import { createEncoderEmbeddings, embeddingPrefixesFor } from '../embeddings';
import {
  getModelProfile,
  hasMemoryForEmbeddings,
  hasMemoryForWebSearch,
  isMemoryConstrained,
  isWebSearchReady,
} from '../modelProfile';
import { RecursiveCharacterTextSplitter } from '../text/textSplitter';
import { NEW_CHAT_KEY, useWebSearchStore } from '../webSearchStore';

jest.mock('helpers', () => ({
  log: jest.fn(),
  modelRequiredMemoryGB: (model: { sizeGB?: number }) => model.sizeGB ?? 0,
}));

const model = (parameterCountBillions: number, sizeGB = 1) => ({
  name: 'm',
  family: 'f',
  parameterCountBillions,
  parts: [],
  sizeGB,
});

describe('getModelProfile', () => {
  it('uses the LLM planner only from 2B parameters', () => {
    expect(getModelProfile(model(1.7)).webPlanner).toBe('verbatim');
    expect(getModelProfile(model(2)).webPlanner).toBe('llm');
  });

  it('keeps models under 0.7B off web search, and unknown sizes on', () => {
    expect(isWebSearchReady(model(0.6))).toBe(false);
    expect(isWebSearchReady(model(0.8))).toBe(true);
    expect(isWebSearchReady(model(0))).toBe(true);
  });

  it('reserves a share of the actual context for the answer', () => {
    const profile = getModelProfile({
      ...model(4),
      contextWindowTokens: 8000,
    });
    expect(profile.contextWindowTokens).toBe(8000);
    expect(profile.generationReserveTokens).toBe(2000);
  });
});

describe('memory gates', () => {
  it('refuses a search next to a model that fills the device', () => {
    expect(hasMemoryForWebSearch(model(4, 2.5), 8)).toBe(true);
    expect(hasMemoryForWebSearch(model(8, 4.9), 6)).toBe(false);
    expect(hasMemoryForWebSearch(model(8, 4.9), undefined)).toBe(true);
  });

  it('runs low-memory when little is left beside the model', () => {
    expect(isMemoryConstrained(model(4, 2.5), 12)).toBe(false);
    expect(isMemoryConstrained(model(4, 2.5), 6)).toBe(true);
  });

  it('only loads an embedding model that fits too', () => {
    const embedding = { parts: [], sizeGB: 0.3 };
    expect(hasMemoryForEmbeddings(model(4, 2.5), embedding, 8)).toBe(true);
    expect(hasMemoryForEmbeddings(model(8, 5.5), embedding, 8)).toBe(false);
    expect(hasMemoryForEmbeddings(model(4, 2.5), undefined, 8)).toBe(false);
  });
});

describe('embeddings adapter', () => {
  it('picks the role prefixes from the family', () => {
    expect(embeddingPrefixesFor('EmbeddingGemma').query).toBe(
      'task: search result | query: ',
    );
    expect(embeddingPrefixesFor('nomic-embed').document).toBe(
      'search_document: ',
    );
    expect(embeddingPrefixesFor('unknown')).toEqual({
      query: '',
      document: '',
    });
  });

  it('loads around the operation, releases after, and prefixes each text', async () => {
    const encode = jest.fn(async (text: string) => [text.length]);
    const load = jest.fn(async () => true);
    const release = jest.fn();
    const embeddings = createEncoderEmbeddings({
      load,
      release,
      borrow: async work => work({ encode } as never),
      prefixes: { query: 'q: ', document: 'd: ' },
    });

    const vectors = await embeddings.runWithLoadedModel(async () => [
      await embeddings.embedQuery('rain'),
      await embeddings.embedDocument('rain'),
    ]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(encode).toHaveBeenCalledWith('q: rain');
    expect(encode).toHaveBeenCalledWith('d: rain');
    expect(vectors).toEqual([[7], [7]]);
  });

  it('does not run the operation when the model could not load', async () => {
    const operation = jest.fn();
    const embeddings = createEncoderEmbeddings({
      load: async () => false,
      release: jest.fn(),
      borrow: async () => undefined,
      prefixes: { query: '', document: '' },
    });

    await expect(embeddings.runWithLoadedModel(operation)).rejects.toThrow(
      'could not be loaded',
    );
    expect(operation).not.toHaveBeenCalled();
  });

  it('releases even when the operation throws', async () => {
    const release = jest.fn();
    const embeddings = createEncoderEmbeddings({
      load: async () => true,
      release,
      borrow: async () => undefined,
      prefixes: { query: '', document: '' },
    });

    await expect(
      embeddings.runWithLoadedModel(() => embeddings.embedQuery('x')),
    ).rejects.toThrow('not loaded');
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe('RecursiveCharacterTextSplitter', () => {
  it('keeps short text whole', async () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 10,
    });
    expect(await splitter.splitText('Rain tomorrow.')).toEqual([
      'Rain tomorrow.',
    ]);
  });

  it('splits on paragraphs first and keeps every chunk under the size', async () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 60,
      chunkOverlap: 10,
    });
    const text = [
      'Paris will see rain in the afternoon tomorrow.',
      'Lyon stays dry with sunny spells all day long.',
      'Marseille gets wind from the north in the evening hours.',
    ].join('\n\n');

    const chunks = await splitter.splitText(text);

    expect(chunks).toEqual([
      'Paris will see rain in the afternoon tomorrow.',
      'Lyon stays dry with sunny spells all day long.',
      'Marseille gets wind from the north in the evening hours.',
    ]);
  });

  it('falls back to words for a paragraph longer than the size, overlapping', async () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 20,
      chunkOverlap: 8,
    });

    const chunks = await splitter.splitText(
      'one two three four five six seven eight nine ten',
    );

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(20);
    }
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[1]!.split(' ')[0]).toBe(chunks[0]!.split(' ').at(-1));
  });

  it('rejects an overlap as large as the chunk', () => {
    expect(
      () =>
        new RecursiveCharacterTextSplitter({ chunkSize: 10, chunkOverlap: 10 }),
    ).toThrow();
  });
});

describe('webSearchStore', () => {
  beforeEach(() => {
    useWebSearchStore.setState({ enabledByChat: {}, webSearchTrace: [] });
  });

  it('keeps the toggle of a new chat under its own key and moves it to the conversation', () => {
    const store = useWebSearchStore.getState();
    store.setEnabled(undefined, true);
    expect(useWebSearchStore.getState().isEnabled(undefined)).toBe(true);

    store.transfer(NEW_CHAT_KEY, 12);

    expect(useWebSearchStore.getState().isEnabled(12)).toBe(true);
    expect(useWebSearchStore.getState().isEnabled(undefined)).toBe(false);
  });

  it('starts a fresh trace with each search and folds consecutive phases', () => {
    const store = useWebSearchStore.getState();
    store.pushWebSearchEvent({ type: 'searching', query: 'old' });
    store.setSearchingWeb(true);
    store.pushWebSearchEvent({ type: 'reading' });
    store.pushWebSearchEvent({ type: 'ranking' });

    const trace = useWebSearchStore.getState().webSearchTrace;
    expect(trace.map(entry => entry.type)).toEqual(['ranking']);
  });

  it('clears a notice only by its own id', () => {
    const store = useWebSearchStore.getState();
    store.showNotice('nothingFound');
    const first = useWebSearchStore.getState().notice!;
    store.showNotice('noRoom');

    store.clearNotice(first.id);
    expect(useWebSearchStore.getState().notice?.kind).toBe('noRoom');
  });
});
