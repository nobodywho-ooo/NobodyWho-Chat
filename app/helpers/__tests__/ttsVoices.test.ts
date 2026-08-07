import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';

import { defaultTtsLanguage, resolveTtsPrefs } from '../ttsVoices';

// listVoiceStyles (used by resolveTtsPrefs) reads the mocked File/Directory
// API from jest/mock/node-modules; stage voice_styles entries through it.
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

describe('defaultTtsLanguage', () => {
  test("maps the model's first declared language to its code", () => {
    expect(defaultTtsLanguage(['German', 'English'])).toBe('de');
  });

  test('falls back to English when the model declares no languages', () => {
    expect(defaultTtsLanguage([])).toBe('en');
  });
});

describe('resolveTtsPrefs', () => {
  const supertonic = buildModel(9, {
    pipeline: ModelPipeline.textToSpeech,
    family: 'Supertonic',
    languages: ['English'],
  });

  test('fills a Supertonic model with its first preset and first language', () => {
    Directory.mockEntries = [voiceFile('F1.json'), voiceFile('M1.json')];

    expect(resolveTtsPrefs(supertonic, {})).toStrictEqual({
      ttsVoice: 'M1',
      ttsLanguage: 'en',
    });
  });

  test("keeps the user's existing Supertonic choice", () => {
    Directory.mockEntries = [voiceFile('M1.json'), voiceFile('F3.json')];

    expect(
      resolveTtsPrefs(supertonic, { ttsVoice: 'F3', ttsLanguage: 'de' }),
    ).toStrictEqual({ ttsVoice: 'F3', ttsLanguage: 'de' });
  });

  test('clears voice/language for a non-Supertonic engine', () => {
    const kokoro = buildModel(5, {
      pipeline: ModelPipeline.textToSpeech,
      family: 'Kokoro',
    });

    // Even a stale Supertonic pair is wiped so Kokoro never receives it.
    expect(
      resolveTtsPrefs(kokoro, { ttsVoice: 'M1', ttsLanguage: 'en' }),
    ).toStrictEqual({ ttsVoice: undefined, ttsLanguage: undefined });
  });
});
