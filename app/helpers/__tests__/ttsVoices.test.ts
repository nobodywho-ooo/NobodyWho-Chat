import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';

import { resolveTtsPrefs } from '../ttsVoices';

// resolveTtsPrefs reads the voices/languages each engine ships in the model
// folder through the mocked File/Directory API from jest/mock/node-modules;
// stage the entries through it.
const { File, Directory } = jest.requireMock('expo-file-system');
const entry = (path: string) =>
  new File(`file:///mock-documents/models/${path}`);
const subdirectory = (path: string) =>
  new Directory(`file:///mock-documents/models/${path}`);

beforeEach(() => {
  Directory.mockExists = true;
  Directory.mockEntries = [];
});

afterAll(() => {
  Directory.mockExists = true;
  Directory.mockEntries = [];
});

describe('resolveTtsPrefs', () => {
  const supertonic = buildModel(9, {
    pipeline: ModelPipeline.textToSpeech,
    family: 'Supertonic',
    languages: ['English'],
  });

  test('fills a Supertonic model with its first preset and first language', () => {
    Directory.mockEntries = [
      entry('9/voice_styles/F1.json'),
      entry('9/voice_styles/M1.json'),
    ];

    expect(resolveTtsPrefs(supertonic, {})).toStrictEqual({
      ttsVoice: 'M1',
      ttsLanguage: 'en',
    });
  });

  test('drops a carried-over voice this model does not ship', () => {
    // Two models of the same engine can ship disjoint preset sets, so a voice
    // kept from the previously selected one has to be checked against this
    // model's own — handing the loader a preset it has no file for fails the
    // load, and the voice slot lands in Error with no way back from the UI.
    Directory.mockEntries = [
      entry('9/voice_styles/M1.json'),
      entry('9/voice_styles/M2.json'),
    ];

    expect(
      resolveTtsPrefs(supertonic, { ttsVoice: 'F3', ttsLanguage: 'en' }),
    ).toStrictEqual({ ttsVoice: 'M1', ttsLanguage: 'en' });
  });

  test('drops a carried-over language this model does not declare', () => {
    Directory.mockEntries = [entry('9/voice_styles/M1.json')];

    expect(
      resolveTtsPrefs(supertonic, { ttsVoice: 'M1', ttsLanguage: 'de' }),
    ).toStrictEqual({ ttsVoice: 'M1', ttsLanguage: 'en' });
  });

  test("keeps the user's existing choice", () => {
    Directory.mockEntries = [
      entry('9/voice_styles/M1.json'),
      entry('9/voice_styles/F3.json'),
    ];

    expect(
      resolveTtsPrefs(supertonic, { ttsVoice: 'F3', ttsLanguage: 'en' }),
    ).toStrictEqual({ ttsVoice: 'F3', ttsLanguage: 'en' });
  });

  test('resolves a Kokoro model in its own vocabulary', () => {
    const kokoro = buildModel(5, {
      pipeline: ModelPipeline.textToSpeech,
      family: 'Kokoro 82M',
      languages: ['English'],
    });
    Directory.mockEntries = [
      entry('5/voices/bf_emma.safetensors'),
      entry('5/voices/bf_alice.safetensors'),
    ];

    // Named voices from voices/, and the locale-tagged language code Kokoro
    // takes — never Supertonic's "M1"/"en", which it would reject.
    expect(
      resolveTtsPrefs(kokoro, { ttsVoice: 'M1', ttsLanguage: 'en' }),
    ).toStrictEqual({ ttsVoice: 'bf_alice', ttsLanguage: 'en-gb' });
  });

  test('resolves a pocket-tts model to a shipped language bundle', () => {
    const pocket = buildModel(3, {
      pipeline: ModelPipeline.textToSpeech,
      family: 'Pocket TTS',
      languages: ['English', 'Korean'],
    });
    Directory.mockEntries = [subdirectory('3/onnx/english_2026-04')];

    // Its voice states are gated outside the model folder, so there is nothing
    // to offer and the engine keeps its built-in default; Korean ships no
    // bundle, so only English is on offer.
    expect(resolveTtsPrefs(pocket, {})).toStrictEqual({
      ttsVoice: undefined,
      ttsLanguage: 'english_2026-04',
    });
  });

  test('clears both for a family that matches no engine', () => {
    const unknown = buildModel(7, {
      pipeline: ModelPipeline.textToSpeech,
      family: 'Piper',
      languages: ['English'],
    });

    expect(
      resolveTtsPrefs(unknown, { ttsVoice: 'M1', ttsLanguage: 'en' }),
    ).toStrictEqual({ ttsVoice: undefined, ttsLanguage: undefined });
  });
});
