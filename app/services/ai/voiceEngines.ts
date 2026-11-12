import { useCallback } from 'react';
import { DEFAULT_ASSISTANT_CONFIG, getAppState } from 'database';
import { getModelById } from 'repositories';
import { log } from 'helpers';
import { Model, ModelSlot, modelSlotSpec } from 'types';

import type { AiSlots } from './AiService';

// The speech engines (TTS, STT, VAD) load on first use rather than at launch
// and on every return to the app. Most sessions never touch them, and each one
// costs load time and resident memory that the chat model would rather have —
// on resume especially, where they used to queue in front of nothing and delay
// nothing but still held their memory for the rest of the session.
export type VoiceSlot = ModelSlot.tts | ModelSlot.stt | ModelSlot.vad;

export const VOICE_SLOTS: readonly VoiceSlot[] = [
  ModelSlot.tts,
  ModelSlot.stt,
  ModelSlot.vad,
];

// Load-time options are read from the assistant config at the moment of the
// load. Voice and language were resolved when the model was selected (see
// resolveTtsPrefs), each in its engine's vocabulary; undefined lets the engine
// keep its own default. For STT, undefined is the automatic setting.
const createVoiceEngine = (
  slots: AiSlots,
  slot: VoiceSlot,
  model: Model,
): Promise<boolean> => {
  const { assistantConfig = DEFAULT_ASSISTANT_CONFIG } = getAppState();

  switch (slot) {
    case ModelSlot.tts:
      return slots.tts.create({
        model,
        voice: assistantConfig.ttsVoice,
        language: assistantConfig.ttsLanguage,
      });
    case ModelSlot.stt:
      return slots.stt.create({ model, language: assistantConfig.sttLanguage });
    case ModelSlot.vad:
      return slots.vad.create({ model });
  }
};

// Resolves to whether the slot is now serving the model selected for it.
// Cheap when it already is (create short-circuits on the same model), so
// callers ensure before every use instead of tracking load state themselves.
// Never rejects: a failed load is logged and its slot publishes Error.
export const useEnsureVoiceEngine = (slots: AiSlots) =>
  useCallback(
    async (slot: VoiceSlot): Promise<boolean> => {
      const { appStateKey, accepts } = modelSlotSpec(slot);

      try {
        const modelId = getAppState()[appStateKey];

        if (modelId === undefined) {
          return false;
        }

        const model = await getModelById(modelId);

        if (model === undefined || !accepts(model.pipeline)) {
          return false;
        }

        // The selection may have moved on while the row was read.
        if (getAppState()[appStateKey] !== modelId) {
          return false;
        }

        return await createVoiceEngine(slots, slot, model);
      } catch (error) {
        log(`AiService ensure ${slot}`, error, { capture: true });
        return false;
      }
    },
    [slots],
  );
