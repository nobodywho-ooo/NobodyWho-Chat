import {
  APP_LICENCES,
  fetchModelLicences,
  isModelLicenceList,
  LICENCES_URL,
} from '../licences';
import { TIMEOUT_MS } from '../modelCatalogue';

const licences = [
  {
    id: 25,
    modelName: 'LFM2.5',
    licenceType: 'LFM Open License v1.0',
    url: 'https://huggingface.co/LiquidAI/LFM2.5-2.6B/blob/main/LICENSE',
  },
];

const mockFetch = (implementation: (...args: any[]) => Promise<unknown>) => {
  const fetchMock = jest.fn(implementation);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

afterEach(() => {
  jest.useRealTimers();
});

test('returns the model licences', async () => {
  const fetchMock = mockFetch(async () => ({
    ok: true,
    json: async () => licences,
  }));

  await expect(fetchModelLicences()).resolves.toEqual(licences);
  expect(fetchMock).toHaveBeenCalledWith(LICENCES_URL, expect.anything());
});

test('rejects a response that is not a list of licences', async () => {
  mockFetch(async () => ({ ok: true, json: async () => ({ error: 'oops' }) }));

  await expect(fetchModelLicences()).rejects.toThrow('not a list of licences');
});

test('rejects on an HTTP error status', async () => {
  mockFetch(async () => ({ ok: false, status: 404 }));

  await expect(fetchModelLicences()).rejects.toThrow('404');
});

test('aborts a request that outlasts the timeout', async () => {
  jest.useFakeTimers();
  mockFetch(
    (_url: string, { signal }: RequestInit) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('Aborted')));
      }),
  );

  const request = fetchModelLicences();
  jest.advanceTimersByTime(TIMEOUT_MS);

  await expect(request).rejects.toThrow('Aborted');
});

test('recognises a licence list by the shape of its entries', () => {
  expect(isModelLicenceList(licences)).toBe(true);
  expect(isModelLicenceList([])).toBe(true);
  expect(isModelLicenceList([{ id: 1, modelName: 'Qwen3' }])).toBe(false);
  expect(isModelLicenceList([{ ...licences[0], id: '25' }])).toBe(false);
  expect(isModelLicenceList([null])).toBe(false);
  expect(isModelLicenceList('[]')).toBe(false);
});

test('credits the web search code under MIT', () => {
  expect(APP_LICENCES).toContainEqual(
    expect.objectContaining({
      titleKey: 'screens.licences.webSearch',
      licenceType: 'MIT',
    }),
  );
});
