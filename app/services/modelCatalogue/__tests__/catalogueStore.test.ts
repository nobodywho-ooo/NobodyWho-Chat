import { act, renderHook, waitFor } from '@testing-library/react-native';

import { MODELS_URL } from 'helpers';
import { buildModel } from 'jest/factories/model';

import {
  CATALOGUE_EXPIRY_MS,
  CATALOGUE_FRESH_MS,
  CATALOGUE_STORAGE_KEY,
  getDeviceCatalogue,
  getModelCatalogue,
  prefetchModelCatalogue,
  refreshModelCatalogue,
  resetModelCatalogueForTests,
  useModelCatalogue,
} from '../catalogueStore';

const mockStorage = new Map<string, string>();

jest.mock('database', () => ({
  getStorage: () => ({
    getItemSync: (key: string) => mockStorage.get(key),
    setItemSync: (key: string, value: string) => mockStorage.set(key, value),
  }),
}));

jest.mock('helpers', () => ({
  ...jest.requireActual('helpers'),
  deviceRamGB: jest.fn(async () => 8),
  log: jest.fn(),
}));

const NOW = 1_000_000_000_000;

const cachedModels = [buildModel(1)];
const fetchedModels = [buildModel(2), buildModel(3)];

const mockFetch = (implementation: () => Promise<unknown>) => {
  const fetchMock = jest.fn(implementation);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const respondWith = (body: unknown) =>
  mockFetch(async () => ({ ok: true, json: async () => body }));

const failFetch = () =>
  mockFetch(async () => {
    throw new TypeError('Network request failed');
  });

const store = (fetchedAt: number, url = MODELS_URL) =>
  mockStorage.set(
    CATALOGUE_STORAGE_KEY,
    JSON.stringify({ models: cachedModels, fetchedAt, url }),
  );

const stored = () => JSON.parse(mockStorage.get(CATALOGUE_STORAGE_KEY)!);

// Lets the fire-and-forget background refresh settle.
const flush = () => act(async () => {});

beforeEach(() => {
  resetModelCatalogueForTests();
  mockStorage.clear();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('fetches once for concurrent callers and stores the result', async () => {
  const fetchMock = respondWith(fetchedModels);

  const [first, second] = await Promise.all([
    getModelCatalogue(),
    getModelCatalogue(),
  ]);

  expect(first).toEqual(fetchedModels);
  expect(second).toEqual(fetchedModels);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(stored()).toEqual({
    models: fetchedModels,
    fetchedAt: NOW,
    url: MODELS_URL,
  });
});

test('serves a fresh stored catalogue without fetching', async () => {
  store(NOW - CATALOGUE_FRESH_MS + 1);
  const fetchMock = respondWith(fetchedModels);

  await expect(getModelCatalogue()).resolves.toEqual(cachedModels);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('serves a stale catalogue at once and refreshes it behind', async () => {
  store(NOW - CATALOGUE_FRESH_MS);
  const fetchMock = respondWith(fetchedModels);

  await expect(getModelCatalogue()).resolves.toEqual(cachedModels);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await flush();
  await expect(getModelCatalogue()).resolves.toEqual(fetchedModels);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('fetches before serving an expired catalogue', async () => {
  store(NOW - CATALOGUE_EXPIRY_MS);
  respondWith(fetchedModels);

  await expect(getModelCatalogue()).resolves.toEqual(fetchedModels);
});

test('falls back to an expired catalogue when offline', async () => {
  store(NOW - CATALOGUE_EXPIRY_MS);
  failFetch();

  await expect(getModelCatalogue()).resolves.toEqual(cachedModels);
});

test('ignores a catalogue stored from another URL', async () => {
  store(NOW, 'https://example.com/v0.json');
  const fetchMock = respondWith(fetchedModels);

  await expect(getModelCatalogue()).resolves.toEqual(fetchedModels);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('ignores an unreadable stored catalogue', async () => {
  mockStorage.set(CATALOGUE_STORAGE_KEY, '{not json');
  respondWith(fetchedModels);

  await expect(getModelCatalogue()).resolves.toEqual(fetchedModels);
});

test('rejects with nothing cached and no network', async () => {
  failFetch();

  await expect(getModelCatalogue()).rejects.toThrow('Network request failed');
});

test('keeps the cached catalogue when the response is broken', async () => {
  store(NOW - CATALOGUE_EXPIRY_MS);
  respondWith({ error: 'rate limited' });

  await expect(refreshModelCatalogue()).rejects.toThrow();
  expect(stored().models).toEqual(cachedModels);
});

test('the startup prefetch always refreshes, even a fresh catalogue', async () => {
  store(NOW);
  const fetchMock = respondWith(fetchedModels);

  prefetchModelCatalogue();
  await flush();

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(stored().models).toEqual(fetchedModels);
});

test('hands the catalogue with the device RAM', async () => {
  respondWith(fetchedModels);

  await expect(getDeviceCatalogue()).resolves.toEqual({
    models: fetchedModels,
    ramGB: 8,
  });
});

describe('useModelCatalogue', () => {
  test('shows a stored catalogue once the device RAM is known', async () => {
    store(NOW);
    const { result } = await renderHook(() => useModelCatalogue());

    await waitFor(() =>
      expect(result.current.catalogue).toEqual({
        models: cachedModels,
        ramGB: 8,
      }),
    );
  });

  test('follows a fetch from start to end', async () => {
    let resolve: (value: unknown) => void = () => {};
    mockFetch(() => new Promise(done => (resolve = done)));
    const { result } = await renderHook(() => useModelCatalogue());

    await act(async () => {
      refreshModelCatalogue();
    });
    expect(result.current.isFetching).toBe(true);
    expect(result.current.catalogue).toBeUndefined();

    await act(async () => {
      resolve({ ok: true, json: async () => fetchedModels });
    });

    expect(result.current).toEqual({
      catalogue: { models: fetchedModels, ramGB: 8 },
      isFetching: false,
      hasFailed: false,
    });
  });

  test('reports a failed fetch', async () => {
    failFetch();
    const { result } = await renderHook(() => useModelCatalogue());

    await act(async () => {
      await refreshModelCatalogue().catch(() => {});
    });

    expect(result.current).toEqual({
      catalogue: undefined,
      isFetching: false,
      hasFailed: true,
    });
  });

  test('never shows an expired catalogue before a fetch fails', async () => {
    store(NOW - CATALOGUE_EXPIRY_MS);
    const { result } = await renderHook(() => useModelCatalogue());
    await flush();

    expect(result.current.catalogue).toBeUndefined();

    failFetch();
    await act(async () => {
      await refreshModelCatalogue().catch(() => {});
    });

    expect(result.current.catalogue?.models).toEqual(cachedModels);
  });
});
