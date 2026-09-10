import { Paths } from 'expo-file-system';

import { buildModel } from 'jest/factories/model';

import {
  availableDiskSpaceGB,
  checkDiskSpaceForModel,
  modelDownloadSizeGB,
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
});
