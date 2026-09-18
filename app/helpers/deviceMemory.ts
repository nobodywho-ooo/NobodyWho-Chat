import { getTotalMemory } from 'react-native-device-info';
import { Model, ModelPart } from 'types';
import { isIOS } from './platform';
import { log } from './log';

const BYTES_PER_GB = 1024 ** 3;

// RAM the OS keeps for itself and never makes available to a model. iOS sits
// around 2 GB; on Android it varies by manufacturer, so we reserve the higher
// estimate to stay safe across devices.
const OS_RESERVED_GB = isIOS ? 2 : 3;

// The projection (mmproj) model is held in memory alongside the chat model, so
// while running its weights effectively take up twice their on-disk size.
const PROJECTION_MODEL_MULTIPLIER = 2;

const totalMemoryGB = async (): Promise<number | undefined> => {
  try {
    const bytes = await getTotalMemory();

    return Number.isFinite(bytes) && bytes > 0
      ? bytes / BYTES_PER_GB
      : undefined;
  } catch (error) {
    log('totalMemoryGB failed', error, { capture: true });
    return undefined;
  }
};

const partMemoryGB = (part: ModelPart): number =>
  part.type === 'projection-model'
    ? part.sizeGB * PROJECTION_MODEL_MULTIPLIER
    : part.sizeGB;

// The RAM a model needs to run: the sum of every part's size, counting the projection model twice.
export const modelRequiredMemoryGB = (model: Model): number =>
  model.parts.reduce((total, part) => total + partMemoryGB(part), 0);

// Keep only the models the device has enough RAM to run. If the device total
// memory can't be read, fall back to returning every model rather than hiding
// all of them.
export const filterModelsByDeviceMemory = async (
  models: Model[],
): Promise<Model[]> => {
  const totalGB = await totalMemoryGB();

  if (totalGB === undefined) {
    return models;
  }

  const usableMemoryGB = totalGB - OS_RESERVED_GB;

  return models.filter(model => modelRequiredMemoryGB(model) <= usableMemoryGB);
};

// Context sizes for a chat that has a projection model loaded, chosen by how
// much memory is left once the OS and the model's own weights are accounted
// for. A flat constant cannot work here: the same value that leaves an 8 GB
// phone comfortable kills a 6 GB one, because what bounds a multimodal chat is
// not the device's RAM but the slice of it this process is allowed to hold.
//
// Measured on the Qwen3.5-0.8B + mmproj-BF16 pair (0.9 GB of weights by the
// accounting above):
//
//   iPhone 13 Pro,  6 GB  (~3.1 GB free here): 2048 fine, 3072 died mid-answer
//                                              on a memory warning, 6072 threw
//                                              std::bad_alloc before answering.
//   iPhone 15 Pro,  8 GB  (~5.1 GB free here): 6048 fine.
//   Pixel 9,       12 GB  (~8.1 GB free here): 6048 fine.
//
// The 3072 result is the informative one: it loaded and only fell over while
// generating, so the ceiling is not "what fits at load" but "what still fits
// once generation, the vision encoder's buffers and the rest of the app are
// live on top of it". The tiers therefore step well clear of it rather than
// creeping up to the last value that booted.
//
// Ordered widest-first; the first tier the device clears wins.
const MULTIMODAL_CONTEXT_TIERS: readonly { freeGB: number; context: number }[] =
  [
    { freeGB: 5, context: 6144 },
    { freeGB: 3, context: 2048 },
  ];

// What a device below every tier gets. Under-measured territory — no device
// this small has been tested with a projection model — so it sits below the
// smallest size known to work anywhere.
const MULTIMODAL_CONTEXT_FLOOR = 1536;

// Used when the device's memory cannot be read at all. The smallest measured-
// good value, rather than the floor: this is the common path on a platform
// where the query fails, not a signal that the device is tiny.
export const MULTIMODAL_CONTEXT_FALLBACK = 2048;

// The largest context to give a chat loading `model` with a projection model.
//
// Note this budgets against *total* memory minus fixed reserves, not against
// what is free right now: a momentary reading would make the same model load
// differently from one launch to the next, and the context size is fixed for
// the life of the chat, so a lucky reading would be paid for later.
export const multimodalContextSize = async (model: Model): Promise<number> => {
  const totalGB = await totalMemoryGB();

  if (totalGB === undefined) {
    return MULTIMODAL_CONTEXT_FALLBACK;
  }

  const freeGB = totalGB - OS_RESERVED_GB - modelRequiredMemoryGB(model);

  const tier = MULTIMODAL_CONTEXT_TIERS.find(
    candidate => freeGB >= candidate.freeGB,
  );

  return tier?.context ?? MULTIMODAL_CONTEXT_FLOOR;
};
