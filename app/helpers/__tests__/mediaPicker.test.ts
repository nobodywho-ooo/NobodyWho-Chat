import {
  mockGetDocumentAsync,
  mockImageSaveAsync,
  mockLaunchImageLibraryAsync,
} from 'jest/mock/node-modules';

import { isForegroundHeld } from '../foregroundHold';
import {
  pickAudioToMessageDocuments,
  pickImageToMessageDocuments,
} from '../mediaPicker';

beforeEach(() => {
  mockLaunchImageLibraryAsync.mockReset();
  mockGetDocumentAsync.mockReset();
  mockImageSaveAsync
    .mockReset()
    .mockResolvedValue({ uri: 'file:///tmp/out.jpg' });
});

test('holds nothing when idle', () => {
  expect(isForegroundHeld()).toBe(false);
});

test('holds the foreground only while the photo library is on screen', async () => {
  // Hold the picker open so we can observe the guard mid-flight: this is the
  // window during which Android reports 'background' and the navigator must NOT
  // tear down the model.
  let releasePicker: (result: unknown) => void = () => {};
  mockLaunchImageLibraryAsync.mockReturnValue(
    new Promise(resolve => {
      releasePicker = resolve;
    }),
  );

  expect(isForegroundHeld()).toBe(false);

  const pending = pickImageToMessageDocuments();
  expect(isForegroundHeld()).toBe(true);

  releasePicker({ canceled: true, assets: [] });
  await pending;

  expect(isForegroundHeld()).toBe(false);
});

test('releases the hold even when the document picker is canceled', async () => {
  mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });

  await pickAudioToMessageDocuments();

  expect(isForegroundHeld()).toBe(false);
});

test('releases the hold if the picker rejects', async () => {
  mockLaunchImageLibraryAsync.mockRejectedValue(new Error('picker boom'));

  await expect(pickImageToMessageDocuments()).rejects.toThrow('picker boom');
  expect(isForegroundHeld()).toBe(false);
});
