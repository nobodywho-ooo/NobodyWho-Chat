import { Model } from 'types';

import { ttsEngineForModel } from './ttsEngine';

// Resolves the voice/language to store when `model` becomes the in-use TTS
// model, reconciling the current prefs against what that model's engine offers
// (see the per-engine vocabularies in ttsEngine.ts). Each option is kept only
// when this model actually offers it, otherwise it falls back to the first one
// offered — so a code carried over from the previously selected model is never
// handed to an engine that would reject it. Both end up undefined for an engine
// with nothing to offer, which loads it on its own built-in defaults.
//
// Persisting this at selection time lets the loader and picker read the config
// directly, without re-deriving a fallback each time.
export const resolveTtsPrefs = (
  model: Model,
  current: { ttsVoice?: string; ttsLanguage?: string },
): { ttsVoice?: string; ttsLanguage?: string } => {
  const engine = ttsEngineForModel(model);

  if (engine === undefined) {
    return { ttsVoice: undefined, ttsLanguage: undefined };
  }

  // Both lists are per-model, not just per-engine: two models of the same
  // engine can ship disjoint voice presets and declare different languages, so
  // a carried-over value has to be checked against this model's own rather than
  // kept just because it is set — the loader fails on a voice the model has no
  // file for, and the voice slot then lands in Error with no way back from the
  // UI.
  const voices = engine.voices(model);
  const languages = engine.languages(model).map(language => language.code);

  const kept = (value: string | undefined, offered: string[]) =>
    value !== undefined && offered.includes(value) ? value : undefined;

  return {
    ttsVoice: kept(current.ttsVoice, voices) ?? voices[0],
    ttsLanguage: kept(current.ttsLanguage, languages) ?? languages[0],
  };
};
