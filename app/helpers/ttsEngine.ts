import type { TextToSpeechArchitecture } from 'react-native-nobodywho';
import { Model } from 'types';

import { listModelFiles, listModelSubdirectories } from './modelDownload';

export interface TtsLanguageOption {
  name: string;
  code: string;
}

// What the app needs to know about each TTS engine nobodywho can load.
//
// Kokoro rejects synthesize() calls over its phoneme cap, so long text has to
// be split and the resulting WAVs stitched client-side. Supertonic and
// pocket-tts chunk internally.
export interface TtsEngine {
  architecture: TextToSpeechArchitecture;
  voices: (model: Model) => string[];
  languages: (model: Model) => TtsLanguageOption[];
  needsClientChunking: boolean;
}

interface TtsEngineEntry extends TtsEngine {
  // Matched against the lowercased family, so "Kokoro 82M" still resolves.
  match: RegExp;
}

// Supertonic takes bare ISO 639-1 codes, per its model card.
const SUPERTONIC_LANGUAGES: Record<string, string> = {
  English: 'en',
  Korean: 'ko',
  Japanese: 'ja',
  Arabic: 'ar',
  Bulgarian: 'bg',
  Czech: 'cs',
  Danish: 'da',
  German: 'de',
  Greek: 'el',
  Spanish: 'es',
  Estonian: 'et',
  Finnish: 'fi',
  French: 'fr',
  Hindi: 'hi',
  Croatian: 'hr',
  Hungarian: 'hu',
  Indonesian: 'id',
  Italian: 'it',
  Lithuanian: 'lt',
  Latvian: 'lv',
  Dutch: 'nl',
  Polish: 'pl',
  Portuguese: 'pt',
  Romanian: 'ro',
  Russian: 'ru',
  Slovak: 'sk',
  Slovenian: 'sl',
  Swedish: 'sv',
  Turkish: 'tr',
  Ukrainian: 'uk',
  Vietnamese: 'vi',
};

const KOKORO_LANGUAGES: Record<string, string> = {
  English: 'en-gb',
  'British English': 'en-gb',
  'American English': 'en-us',
  Spanish: 'es',
  French: 'fr-fr',
  Hindi: 'hi',
  Italian: 'it',
  Japanese: 'ja',
  Portuguese: 'pt-br',
  Chinese: 'zh',
};

const tabledLanguages =
  (table: Record<string, string>) =>
  (model: Model): TtsLanguageOption[] =>
    model.languages.flatMap(name => {
      const code = table[name];
      return code === undefined ? [] : [{ name, code }];
    });

const voiceStyleRank = (code: string): number => {
  const rank = ['M', 'F'].indexOf(code.charAt(0).toUpperCase());
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
};

const ENGINES: readonly TtsEngineEntry[] = [
  {
    architecture: 'supertonic',
    match: /supertonic/,
    voices: model =>
      listModelFiles(model.id, 'voice_styles', '.json').sort(
        (a, b) => voiceStyleRank(a) - voiceStyleRank(b),
      ),
    languages: tabledLanguages(SUPERTONIC_LANGUAGES),
    needsClientChunking: false,
  },
  {
    architecture: 'kokoro',
    match: /kokoro/,
    voices: model => listModelFiles(model.id, 'voices', '.safetensors'),
    languages: tabledLanguages(KOKORO_LANGUAGES),
    needsClientChunking: true,
  },
  {
    architecture: 'pocket-tts',
    match: /pocket[\s-]?tts/,
    voices: () => [],
    languages: model => {
      const bundles = listModelSubdirectories(model.id, 'onnx');
      return model.languages.flatMap(name => {
        const code = bundles.find(bundle =>
          bundle.toLowerCase().startsWith(name.toLowerCase()),
        );
        return code === undefined ? [] : [{ name, code }];
      });
    },
    needsClientChunking: false,
  },
];

export const ttsEngineForFamily = (family: string): TtsEngine | undefined => {
  const normalized = family.toLowerCase();
  return ENGINES.find(engine => engine.match.test(normalized));
};

export const ttsEngineForModel = (model: Model): TtsEngine | undefined =>
  ttsEngineForFamily(model.family);

export const ttsEngineForArchitecture = (
  architecture: TextToSpeechArchitecture | undefined,
): TtsEngine | undefined =>
  ENGINES.find(engine => engine.architecture === architecture);
