import { Paths } from 'expo-file-system';

import { buildModel } from 'jest/factories/model';

import {
  availableDiskSpaceGB,
  checkDiskSpaceForModel,
  modelDownloadProgress,
  modelDownloadSizeGB,
  overallDownloadProgress,
  remainingDownloadSizeGB,
} from '../diskSpace';

const GB = 1024 ** 3;

const part = (type: string, sizeGB: number) => ({
  url: `https://example.com/${type}.gguf`,
  fileName: `${type}.gguf`,
  type,
  path: '',
  sizeGB,
});

// `Paths.availableDiskSpace` is a getter on the real module; the mock exposes a
// plain property so a test can set the volume's free space in bytes.
const setAvailableDiskSpace = (value: unknown) => {
  (Paths as unknown as { availableDiskSpace: unknown }).availableDiskSpace =
    value;
};

beforeEach(() => {
  setAvailableDiskSpace(64 * GB);
});

describe('availableDiskSpaceGB', () => {
  test('converts the reported bytes to GB', () => {
    setAvailableDiskSpace(2.5 * GB);
    expect(availableDiskSpaceGB()).toBe(2.5);
  });

  test.each([undefined, null, NaN, -1])(
    'is undefined when the platform reports %p',
    value => {
      setAvailableDiskSpace(value);
      expect(availableDiskSpaceGB()).toBeUndefined();
    },
  );
});

describe('modelDownloadSizeGB', () => {
  test('sums every part size, ignoring Model.sizeGB', () => {
    const model = buildModel(1, {
      sizeGB: 99,
      parts: [part('chat-model', 3), part('projection-model', 1)],
    });
    expect(modelDownloadSizeGB(model)).toBe(4);
  });

  test('falls back to Model.sizeGB when the parts carry no sizes', () => {
    expect(modelDownloadSizeGB(buildModel(1, { sizeGB: 2 }))).toBe(2);
  });
});

describe('checkDiskSpaceForModel', () => {
  const model = buildModel(1, { parts: [part('chat-model', 4)] });

  test('fits when free space covers the model and the reserve', () => {
    setAvailableDiskSpace(5 * GB);
    expect(checkDiskSpaceForModel(model)).toEqual({
      fits: true,
      requiredGB: 4.5,
      availableGB: 5,
    });
  });

  test('does not fit when free space only covers the model itself', () => {
    setAvailableDiskSpace(4.2 * GB);
    expect(checkDiskSpaceForModel(model)).toMatchObject({
      fits: false,
      requiredGB: 4.5,
    });
  });

  test('fits when free space cannot be read, rather than blocking the download', () => {
    setAvailableDiskSpace(undefined);
    expect(checkDiskSpaceForModel(model)).toEqual({
      fits: true,
      requiredGB: 4.5,
      availableGB: undefined,
    });
  });

  test('keeps back what downloads in progress still have to write', () => {
    // 3 GB left of another model's 4 GB part: 6 - 3 leaves 3 GB, short of 4.5.
    const other = buildModel(2, { parts: [part('chat-model', 4)] });
    const inProgress = [
      {
        model: other,
        partsProgress: other.parts.map(p => ({ ...p, progress: 0.25 })),
      },
    ];
    setAvailableDiskSpace(6 * GB);

    expect(checkDiskSpaceForModel(model, inProgress)).toEqual({
      fits: false,
      requiredGB: 4.5,
      availableGB: 3,
    });
  });

  test("ignores the model's own download row", () => {
    const inProgress = [
      {
        model,
        partsProgress: model.parts.map(p => ({ ...p, progress: 0 })),
      },
    ];
    setAvailableDiskSpace(5 * GB);

    expect(checkDiskSpaceForModel(model, inProgress).fits).toBe(true);
  });
});

describe('remainingDownloadSizeGB', () => {
  test("weights each part's size by what is left of it", () => {
    const model = buildModel(1, {
      parts: [part('chat-model', 4), part('projection-model', 1)],
    });
    const download = {
      model,
      partsProgress: [
        { ...model.parts[0], progress: 0.5 },
        { ...model.parts[1], progress: 1 },
      ],
    };

    expect(remainingDownloadSizeGB(download)).toBe(2);
  });
});

describe('modelDownloadProgress', () => {
  test('weights each part by its size', () => {
    const download = {
      model: buildModel(3),
      partsProgress: [
        { ...part('chat-model', 3), progress: 1 }, // fully done, weight 3
        { ...part('projection-model', 1), progress: 0 }, // not started, weight 1
      ],
    };

    // (1*3 + 0*1) / (3 + 1) = 0.75
    expect(modelDownloadProgress(download)).toBe(0.75);
  });

  test('returns 0 when there is no size to weigh', () => {
    expect(
      modelDownloadProgress({ model: buildModel(3), partsProgress: [] }),
    ).toBe(0);
  });
});

describe('overallDownloadProgress', () => {
  const downloadOf = (id: number, sizeGB: number, progress: number) => {
    const chat = part('chat-model', sizeGB);
    return {
      model: buildModel(id, { parts: [chat] }),
      partsProgress: [{ ...chat, progress }],
    };
  };

  test('weights each download by its model size', () => {
    // (3*1 + 1*0) / (3 + 1)
    expect(
      overallDownloadProgress([downloadOf(1, 3, 1), downloadOf(2, 1, 0)]),
    ).toBe(0.75);
  });

  test('is 0 with nothing to weigh', () => {
    expect(overallDownloadProgress([])).toBe(0);
  });
});
