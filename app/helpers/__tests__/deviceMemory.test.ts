import { mockGetTotalMemory } from 'jest/mock/node-modules';
import { buildModel } from 'jest/factories/model';

import {
  filterModelsByDeviceMemory,
  modelRequiredMemoryGB,
} from '../deviceMemory';

const part = (type: string, sizeGB: number) => ({
  url: `https://example.com/${type}.gguf`,
  fileName: `${type}.gguf`,
  type,
  path: '',
  sizeGB,
});

const GB = 1024 ** 3;

beforeEach(() => {
  // 8 GB total, 2 GB reserved for the OS on iOS -> 6 GB usable.
  mockGetTotalMemory.mockResolvedValue(8 * GB);
});

describe('modelRequiredMemoryGB', () => {
  test('sums every part size, ignoring Model.sizeGB', () => {
    const model = buildModel(1, {
      sizeGB: 99,
      parts: [part('chat-model', 3), part('chat-model', 1)],
    });
    expect(modelRequiredMemoryGB(model)).toBe(4);
  });

  test('counts the projection model size twice', () => {
    const model = buildModel(1, {
      parts: [part('chat-model', 3), part('projection-model', 1)],
    });
    expect(modelRequiredMemoryGB(model)).toBe(5);
  });

  test('is 0 for a model with no parts', () => {
    expect(modelRequiredMemoryGB(buildModel(1, { parts: [] }))).toBe(0);
  });
});

describe('filterModelsByDeviceMemory', () => {
  test('keeps models that fit in usable memory and drops the rest', async () => {
    const fits = buildModel(1, { parts: [part('chat-model', 6)] });
    const tooBig = buildModel(2, { parts: [part('chat-model', 7)] });
    // 4 + 1*2 = 6 GB, exactly the usable budget -> kept.
    const fitsWithProjection = buildModel(3, {
      parts: [part('chat-model', 4), part('projection-model', 1)],
    });

    const result = await filterModelsByDeviceMemory([
      fits,
      tooBig,
      fitsWithProjection,
    ]);

    expect(result.map(model => model.id)).toEqual([1, 3]);
  });

  test('returns every model when total memory cannot be read', async () => {
    mockGetTotalMemory.mockRejectedValue(new Error('unavailable'));
    const models = [
      buildModel(1, { parts: [part('chat-model', 99)] }),
      buildModel(2, { parts: [part('chat-model', 99)] }),
    ];

    const result = await filterModelsByDeviceMemory(models);

    expect(result).toEqual(models);
  });
});
