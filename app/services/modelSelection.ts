import {
  AppState,
  DEFAULT_ASSISTANT_CONFIG,
  getAppState,
  setAppState,
} from 'database';
import { resolveTtsPrefs } from 'helpers';
import {
  MODEL_SLOTS,
  Model,
  ModelPipeline,
  ModelSlot,
  modelSlotSpec,
  slotForPipeline,
} from 'types';

// Selecting a model is not just writing an id: taking the chat slot invalidates
// the open conversation, and taking the voice slot stamps the model's
// voice/language defaults into the assistant config so the loader and the
// picker can read them directly. Spreading those two special cases across every
// selection site — the downloaded-models list, the download completion handler,
// the startup sweep — is how they drift apart, so they live here instead.

// Which model currently occupies the slot a model of `pipeline` would take.
// Undefined for a pipeline no slot accepts (featureExtraction, textRanking, …).
export const inUseModelIdForPipeline = (
  pipeline: ModelPipeline,
  state: AppState,
): number | undefined => {
  const slot = slotForPipeline(pipeline);
  return slot === undefined
    ? undefined
    : state[modelSlotSpec(slot).appStateKey];
};

// Put `model` into whichever slot its pipeline fits. Resolves to false — having
// written nothing — when the model already holds that slot, or when no slot
// accepts it.
export const selectModel = async (model: Model): Promise<boolean> => {
  const slot = slotForPipeline(model.pipeline);

  if (slot === undefined) {
    return false;
  }

  const { appStateKey } = modelSlotSpec(slot);

  if (getAppState()[appStateKey] === model.id) {
    return false;
  }

  if (slot === ModelSlot.chat) {
    await setAppState({
      modelIdInUse: model.id,
      conversationIdInUse: undefined,
    });
    return true;
  }

  if (slot === ModelSlot.tts) {
    const config = getAppState().assistantConfig ?? DEFAULT_ASSISTANT_CONFIG;
    await setAppState({
      ttsModelIdInUse: model.id,
      assistantConfig: { ...config, ...resolveTtsPrefs(model, config) },
    });
    return true;
  }

  // A computed key over a union of literals widens to a string index
  // signature — assert the narrow shape back.
  await setAppState({ [appStateKey]: model.id } as Partial<AppState>);
  return true;
};

// Take `model` into its slot only if that slot is still empty, so a finished
// download becomes usable without displacing a choice the user already made.
export const selectModelIfSlotFree = async (model: Model): Promise<boolean> => {
  const slot = slotForPipeline(model.pipeline);

  if (
    slot === undefined ||
    getAppState()[modelSlotSpec(slot).appStateKey] !== undefined
  ) {
    return false;
  }

  return selectModel(model);
};

// Every slot `modelId` currently occupies — normally one, but a model is only
// ever matched by id here, so a delete can release all of them without
// repeating the per-slot cases.
export const slotsHolding = (modelId: number, state: AppState): ModelSlot[] =>
  MODEL_SLOTS.filter(({ appStateKey }) => state[appStateKey] === modelId).map(
    ({ slot }) => slot,
  );

// Clear the given slots. The chat slot drops its conversation with it: a
// conversation outlives its model only to dead-end on the error screen.
export const releaseSlots = async (slots: ModelSlot[]): Promise<void> => {
  if (slots.length === 0) {
    return;
  }

  const patch: Partial<AppState> = {};

  for (const slot of slots) {
    const { appStateKey } = modelSlotSpec(slot);
    patch[appStateKey] = undefined;

    if (slot === ModelSlot.chat) {
      patch.conversationIdInUse = undefined;
    }
  }

  await setAppState(patch);
};
