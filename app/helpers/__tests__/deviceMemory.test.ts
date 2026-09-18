import { mockGetTotalMemory } from 'jest/mock/node-modules';
import { buildModel } from 'jest/factories/model';

import {
  MULTIMODAL_CONTEXT_FALLBACK,
  filterModelsByDeviceMemory,
  modelRequiredMemoryGB,
  multimodalContextSize,
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

  // react-native-device-info resolves to -1 rather than rejecting when the
  // platform can't answer. Read as a size it makes every budget negative, so
  // the whole catalogue filtered itself out and the Models screen came up empty
  // with nothing to explain why.
  test.each([-1, 0, NaN])(
    'returns every model when total memory reads as %p',
    async bytes => {
      mockGetTotalMemory.mockResolvedValue(bytes);
      const models = [
        buildModel(1, { parts: [part('chat-model', 1)] }),
        buildModel(2, { parts: [part('chat-model', 2)] }),
      ];

      const result = await filterModelsByDeviceMemory(models);

      expect(result).toEqual(models);
    },
  );
});

describe('multimodalContextSize', () => {
  // The pair the tiers were measured against: 0.5 GB of weights plus a 0.2 GB
  // projector, which counts double while loaded — 0.9 GB in this accounting.
  const visionModel = buildModel(1, {
    parts: [part('chat-model', 0.5), part('projection-model', 0.2)],
  });

  test('gives a 6 GB device the size measured safe on one', async () => {
    // iPhone 13 Pro: 6 - 2 - 0.9 = 3.1 GB free. 3072 died mid-answer there, so
    // this tier must not reach it.
    mockGetTotalMemory.mockResolvedValue(6 * GB);
    expect(await multimodalContextSize(visionModel)).toBe(2048);
  });

  test('opens up on an 8 GB device, where a wide context was measured fine', async () => {
    // iPhone 15 Pro: 8 - 2 - 0.9 = 5.1 GB free.
    mockGetTotalMemory.mockResolvedValue(8 * GB);
    expect(await multimodalContextSize(visionModel)).toBe(6144);
  });

  test('a bigger model on the same device gets a smaller context', async () => {
    // The budget is what is left after the weights, not the device total: on
    // the same 8 GB phone that gives the small pair 6144, a 2 GB vision model
    // (1.5 + 0.25x2) leaves 4 GB and drops out of the top tier.
    const heavy = buildModel(2, {
      parts: [part('chat-model', 1.5), part('projection-model', 0.25)],
    });
    mockGetTotalMemory.mockResolvedValue(8 * GB);

    expect(await multimodalContextSize(heavy)).toBe(2048);
  });

  test('falls to the floor when almost nothing is left', async () => {
    mockGetTotalMemory.mockResolvedValue(4 * GB);
    expect(await multimodalContextSize(visionModel)).toBe(1536);
  });

  test('falls back to the smallest measured-good size when memory cannot be read', async () => {
    mockGetTotalMemory.mockRejectedValue(new Error('unavailable'));
    expect(await multimodalContextSize(visionModel)).toBe(
      MULTIMODAL_CONTEXT_FALLBACK,
    );
  });

  // The -1 sentinel is "unknown", not "a tiny device": it has to reach the same
  // fallback a rejection does, rather than being budgeted with as a real size.
  test.each([-1, 0, NaN])(
    'falls back to the same size when total memory reads as %p',
    async bytes => {
      mockGetTotalMemory.mockResolvedValue(bytes);
      expect(await multimodalContextSize(visionModel)).toBe(
        MULTIMODAL_CONTEXT_FALLBACK,
      );
    },
  );
});
