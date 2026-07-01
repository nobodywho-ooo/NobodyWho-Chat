import { deleteAsync, getInfoAsync } from 'expo-file-system/legacy';

import {
  deleteMessageDocuments,
  messageDocumentKind,
  messageDocumentName,
  messageDocumentUri,
  resolveMessageDocumentPath,
} from '../messageDocuments';

const mockGetInfo = getInfoAsync as jest.Mock;
const mockDelete = deleteAsync as jest.Mock;

const DIR = '/mock-documents/message-documents';

describe('messageDocumentName', () => {
  test('strips the injected unique suffix, keeping name + extension', () => {
    expect(
      messageDocumentName(
        '/x/message-documents/IMG_0001-1781852282703-796151.heic',
      ),
    ).toBe('IMG_0001.heic');
  });

  test('handles names without an extension', () => {
    expect(messageDocumentName('/x/clip-1781852282703-796151')).toBe('clip');
  });

  test('returns the basename untouched when there is no injected suffix', () => {
    expect(messageDocumentName('/x/plain.png')).toBe('plain.png');
  });
});

describe('messageDocumentKind', () => {
  test('classifies known image extensions, case-insensitively', () => {
    expect(messageDocumentKind('/x/photo.JPG')).toBe('image');
    expect(messageDocumentKind('/x/pic.png')).toBe('image');
    expect(messageDocumentKind('/x/shot.heic')).toBe('image');
  });

  test('classifies known audio extensions', () => {
    expect(messageDocumentKind('/x/note.m4a')).toBe('audio');
    expect(messageDocumentKind('/x/song.mp3')).toBe('audio');
    expect(messageDocumentKind('/x/voice.wav')).toBe('audio');
  });

  test('falls back to "file" for other or missing extensions', () => {
    expect(messageDocumentKind('/x/report.pdf')).toBe('file');
    expect(messageDocumentKind('/x/noextension')).toBe('file');
  });
});

describe('resolveMessageDocumentPath', () => {
  test('joins a stored file name with the current message-documents dir', () => {
    expect(resolveMessageDocumentPath('note.m4a')).toBe(`${DIR}/note.m4a`);
  });

  test('rebuilds from a legacy absolute path saved by a previous install', () => {
    expect(
      resolveMessageDocumentPath(
        '/var/mobile/Containers/Data/Application/OLD-UUID/Documents/message-documents/note.m4a',
      ),
    ).toBe(`${DIR}/note.m4a`);
  });

  test('strips a file:// scheme before rejoining', () => {
    expect(resolveMessageDocumentPath('file:///x/note.m4a')).toBe(
      `${DIR}/note.m4a`,
    );
  });
});

describe('messageDocumentUri', () => {
  test('resolves a stored file name to a file:// URI under the current dir', () => {
    expect(messageDocumentUri('note.m4a')).toBe(`file://${DIR}/note.m4a`);
  });

  test('rebuilds a legacy absolute path into a current file:// URI', () => {
    expect(messageDocumentUri('/old/message-documents/note.m4a')).toBe(
      `file://${DIR}/note.m4a`,
    );
  });
});

describe('deleteMessageDocuments', () => {
  beforeEach(() => {
    mockGetInfo.mockReset();
    mockDelete.mockReset();
  });

  test('deletes each stored name, resolved against the current dir', async () => {
    mockGetInfo.mockResolvedValue({ exists: true });

    await deleteMessageDocuments(['a.png', 'b.mp3']);

    expect(mockDelete).toHaveBeenCalledWith(`file://${DIR}/a.png`, {
      idempotent: true,
    });
    expect(mockDelete).toHaveBeenCalledWith(`file://${DIR}/b.mp3`, {
      idempotent: true,
    });
  });

  test('skips paths that no longer exist', async () => {
    mockGetInfo.mockResolvedValue({ exists: false });

    await deleteMessageDocuments(['missing.png']);

    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('is best-effort: a failing delete never rejects', async () => {
    mockGetInfo.mockResolvedValue({ exists: true });
    mockDelete.mockRejectedValue(new Error('boom'));

    await expect(deleteMessageDocuments(['a.png'])).resolves.toBeUndefined();
  });
});
