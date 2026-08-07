import { listVoiceStyles } from '../modelDownload';

// The new File/Directory API is mocked in jest/mock/node-modules; grab the
// mocked classes to stage directory entries and toggle folder existence.
const { File, Directory } = jest.requireMock('expo-file-system');

const voiceFile = (name: string) =>
  new File(`file:///mock-documents/models/9/voice_styles/${name}`);

beforeEach(() => {
  Directory.mockExists = true;
  Directory.mockEntries = [];
});

afterAll(() => {
  Directory.mockExists = true;
  Directory.mockEntries = [];
});

describe('listVoiceStyles', () => {
  test('returns the preset codes ordered male-first then numerically', () => {
    // Deliberately unsorted, with a non-JSON entry that must be ignored and a
    // two-digit code to prove the ordering is numeric, not lexicographic.
    Directory.mockEntries = [
      voiceFile('F2.json'),
      voiceFile('M1.json'),
      voiceFile('F1.json'),
      voiceFile('M10.json'),
      voiceFile('M2.json'),
      voiceFile('README.txt'),
    ];

    expect(listVoiceStyles(9)).toEqual(['M1', 'M2', 'M10', 'F1', 'F2']);
  });

  test('returns an empty list when the voice_styles folder is absent', () => {
    Directory.mockExists = false;
    Directory.mockEntries = [voiceFile('M1.json')];

    expect(listVoiceStyles(9)).toEqual([]);
  });

  test('returns an empty list when listing throws', () => {
    const original = Directory.prototype.list;
    Directory.prototype.list = () => {
      throw new Error('native list failure');
    };

    try {
      expect(listVoiceStyles(9)).toEqual([]);
    } finally {
      Directory.prototype.list = original;
    }
  });
});
