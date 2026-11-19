import { buildModel } from 'jest/factories/model';

import {
  fetchModelCatalogue,
  isModelCatalogue,
  MODELS_URL,
  TIMEOUT_MS,
} from '../modelCatalogue';

const catalogue = [buildModel(1)];

const mockFetch = (implementation: (...args: any[]) => Promise<unknown>) => {
  const fetchMock = jest.fn(implementation);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

// Never settles on its own; rejects like fetch does once its signal aborts.
const hangUntilAborted = (_url: string, { signal }: RequestInit) =>
  new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new Error('Aborted')));
  });

afterEach(() => {
  jest.useRealTimers();
});

test('returns the catalogue', async () => {
  const fetchMock = mockFetch(async () => ({
    ok: true,
    json: async () => catalogue,
  }));

  await expect(fetchModelCatalogue()).resolves.toEqual(catalogue);
  expect(fetchMock).toHaveBeenCalledWith(MODELS_URL, expect.anything());
});

test('rejects a response that is not a list of models', async () => {
  mockFetch(async () => ({ ok: true, json: async () => ({ error: 'oops' }) }));

  await expect(fetchModelCatalogue()).rejects.toThrow('not a list of models');
});

test('recognises a catalogue by its entries ids and parts', () => {
  expect(isModelCatalogue(catalogue)).toBe(true);
  expect(isModelCatalogue([])).toBe(true);
  expect(isModelCatalogue([{ id: 1 }])).toBe(false);
  expect(isModelCatalogue([null])).toBe(false);
  expect(isModelCatalogue('[]')).toBe(false);
});

test('rejects on an HTTP error status', async () => {
  mockFetch(async () => ({ ok: false, status: 404 }));

  await expect(fetchModelCatalogue()).rejects.toThrow('404');
});

test('aborts a request that outlasts the timeout', async () => {
  jest.useFakeTimers();
  mockFetch(hangUntilAborted as any);

  const request = fetchModelCatalogue();
  const settled = jest.fn();
  request.catch(settled);

  jest.advanceTimersByTime(TIMEOUT_MS - 1);
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();

  jest.advanceTimersByTime(1);
  await expect(request).rejects.toThrow('Aborted');
});

test('clears the timeout once the request completes', async () => {
  jest.useFakeTimers();
  mockFetch(async () => ({ ok: true, json: async () => catalogue }));

  await expect(fetchModelCatalogue()).resolves.toEqual(catalogue);
  expect(jest.getTimerCount()).toBe(0);
});
