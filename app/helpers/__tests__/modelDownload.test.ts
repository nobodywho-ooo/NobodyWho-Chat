import { listModelFiles, listModelSubdirectories } from '../modelDownload';

// The new File/Directory API is mocked in jest/mock/node-modules; grab the
// mocked classes to stage directory entries and toggle folder existence.
const { File, Directory } = jest.requireMock('expo-file-system');

const voiceFile = (name: string) =>
  new File(`file:///mock-documents/models/9/voice_styles/${name}`);

const bundleDir = (name: string) =>
  new Directory(`file:///mock-documents/models/9/onnx/${name}`);

beforeEach(() => {
  Directory.mockExists = true;
  Directory.mockEntries = [];
});

afterAll(() => {
  Directory.mockExists = true;
  Directory.mockEntries = [];
});

describe('listModelFiles', () => {
  test('returns the basenames carrying the extension, numerically sorted', () => {
    // Deliberately unsorted, with a non-JSON entry that must be ignored and a
    // two-digit code to prove the ordering is numeric, not lexicographic.
    Directory.mockEntries = [
      voiceFile('M2.json'),
      voiceFile('M10.json'),
      voiceFile('M1.json'),
      voiceFile('README.txt'),
    ];

    expect(listModelFiles(9, 'voice_styles', '.json')).toEqual([
      'M1',
      'M2',
      'M10',
    ]);
  });

  test('ignores subdirectories', () => {
    Directory.mockEntries = [voiceFile('M1.json'), bundleDir('german')];

    expect(listModelFiles(9, 'voice_styles', '.json')).toEqual(['M1']);
  });

  test('returns an empty list when the folder is absent', () => {
    Directory.mockExists = false;
    Directory.mockEntries = [voiceFile('M1.json')];

    expect(listModelFiles(9, 'voice_styles', '.json')).toEqual([]);
  });

  test('returns an empty list when listing throws', () => {
    const original = Directory.prototype.list;
    Directory.prototype.list = () => {
      throw new Error('native list failure');
    };

    try {
      expect(listModelFiles(9, 'voice_styles', '.json')).toEqual([]);
    } finally {
      Directory.prototype.list = original;
    }
  });
});

describe('listModelSubdirectories', () => {
  test('returns the subdirectory names, ignoring files', () => {
    Directory.mockEntries = [
      bundleDir('german_24l'),
      bundleDir('english_2026-04'),
      new File('file:///mock-documents/models/9/onnx/LICENSE'),
    ];

    expect(listModelSubdirectories(9, 'onnx')).toEqual([
      'english_2026-04',
      'german_24l',
    ]);
  });
});
