import { Model } from 'types';

import { listVoiceStyles } from './modelDownload';

// Maps the catalogue's human-readable language names (as they appear in a
// model's `languages`) to the codes nobodywho's Supertonic engine expects.
// Kept here rather than in the picker so the TTS loader can derive a default
// language from the same table.
export const LANGUAGE_CODES: Record<string, string> = {
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

// Fall back to a lowercased name for any language not in the table.
export const languageCode = (name: string): string =>
  LANGUAGE_CODES[name] ?? name.toLowerCase();

// The default TTS language code when the user hasn't chosen one: the model's
// first declared language, or English (the first table entry) when it declares
// none.
export const defaultTtsLanguage = (languages: string[]): string =>
  languages.length > 0 ? languageCode(languages[0]) : LANGUAGE_CODES.English;

// Resolves the voice/language to store when `model` becomes the in-use TTS
// model, reconciling the current prefs against the model. Voice and language
// are Supertonic-only load-time options:
//   - Supertonic keeps whatever the user already chose, otherwise defaults to
//     the first shipped voice preset and the model's first language.
//   - Any other engine (e.g. Kokoro) clears both, so it is never handed a
//     Supertonic voice code and keeps its own built-in defaults.
// Persisting this at selection time lets the loader and picker read the config
// directly, without re-deriving a fallback each time.
export const resolveTtsPrefs = (
  model: Model,
  current: { ttsVoice?: string; ttsLanguage?: string },
): { ttsVoice?: string; ttsLanguage?: string } => {
  let prefs: { ttsVoice?: string; ttsLanguage?: string } = {
    ttsVoice: undefined,
    ttsLanguage: undefined,
  };

  if (model.family.toLowerCase() === 'supertonic') {
    prefs = {
      ttsVoice: current.ttsVoice ?? listVoiceStyles(model.id)[0],
      ttsLanguage: current.ttsLanguage ?? defaultTtsLanguage(model.languages),
    };
  }

  return prefs;
};
