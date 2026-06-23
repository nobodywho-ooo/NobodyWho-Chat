import { exists, unlink } from '@dr.pogodin/react-native-fs';

import {
  deleteMessageDocuments,
  messageDocumentKind,
  messageDocumentName,
  messageDocumentUri,
  resolveMessageDocumentPath,
} from '../messageDocuments';

const mockExists = exists as jest.Mock;
const mockUnlink = unlink as jest.Mock;

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
    mockExists.mockReset();
    mockUnlink.mockReset();
  });

  test('unlinks each stored name, resolved against the current dir', async () => {
    mockExists.mockResolvedValue(true);

    await deleteMessageDocuments(['a.png', 'b.mp3']);

    expect(mockUnlink).toHaveBeenCalledWith(`${DIR}/a.png`);
    expect(mockUnlink).toHaveBeenCalledWith(`${DIR}/b.mp3`);
  });

  test('skips paths that no longer exist', async () => {
    mockExists.mockResolvedValue(false);

    await deleteMessageDocuments(['missing.png']);

    expect(mockUnlink).not.toHaveBeenCalled();
  });

  test('is best-effort: a failing unlink never rejects', async () => {
    mockExists.mockResolvedValue(true);
    mockUnlink.mockRejectedValue(new Error('boom'));

    await expect(deleteMessageDocuments(['a.png'])).resolves.toBeUndefined();
  });
});
