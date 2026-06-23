import {
  mockGetDocumentAsync,
  mockImageSaveAsync,
  mockLaunchImageLibraryAsync,
} from 'jest/mock/node-modules';

import {
  isExternalPickerActive,
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

test('reports no active picker when idle', () => {
  expect(isExternalPickerActive()).toBe(false);
});

test('flags a picker active only while the photo library is on screen', async () => {
  // Hold the picker open so we can observe the guard mid-flight: this is the
  // window during which Android reports 'background' and the navigator must NOT
  // tear down the model.
  let releasePicker: (result: unknown) => void = () => {};
  mockLaunchImageLibraryAsync.mockReturnValue(
    new Promise(resolve => {
      releasePicker = resolve;
    }),
  );

  expect(isExternalPickerActive()).toBe(false);

  const pending = pickImageToMessageDocuments();
  expect(isExternalPickerActive()).toBe(true);

  releasePicker({ canceled: true, assets: [] });
  await pending;

  expect(isExternalPickerActive()).toBe(false);
});

test('clears the flag even when the document picker is canceled', async () => {
  mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });

  await pickAudioToMessageDocuments();

  expect(isExternalPickerActive()).toBe(false);
});

test('clears the flag if the picker rejects', async () => {
  mockLaunchImageLibraryAsync.mockRejectedValue(new Error('picker boom'));

  await expect(pickImageToMessageDocuments()).rejects.toThrow('picker boom');
  expect(isExternalPickerActive()).toBe(false);
});
