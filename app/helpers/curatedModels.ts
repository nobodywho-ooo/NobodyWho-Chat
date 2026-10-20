import {
  isChatPipeline,
  isSttPipeline,
  isTtsPipeline,
  isVadPipeline,
  Model,
  ModelDownload,
  ModelPipeline,
} from 'types';
import { fitsInDeviceMemory } from './deviceMemory';
import { modelDownloadSizeGB } from './diskSpace';
import { byCatalogueOrder, DeviceCatalogue } from './modelCatalogue';

export const RECOMMENDED_TAG = 'Recommended';
export const FIRST_PICK_TAG = 'Great First Pick';

export interface CuratedModel {
  accepts: (pipeline: ModelPipeline) => boolean;
  matches: (model: Model) => boolean;
  exactMatch?: boolean;
}

// Whether `model`, installed or downloading, already takes care of `curated`.
const fulfills = (model: Model, curated: CuratedModel): boolean =>
  curated.accepts(model.pipeline) &&
  (!curated.exactMatch || curated.matches(model));

const hasTag = (tag: string) => (model: Model) => model.tags.includes(tag);

export const CURATED_TEXT_MODELS: readonly CuratedModel[] = [
  { accepts: isChatPipeline, matches: hasTag(FIRST_PICK_TAG) },
];

export const curatedChatModel = (modelId: number): CuratedModel => ({
  accepts: isChatPipeline,
  matches: model => model.id === modelId,
  exactMatch: true,
});

export const CURATED_VOICE_ONLY_MODELS: readonly CuratedModel[] = [
  { accepts: isSttPipeline, matches: hasTag(RECOMMENDED_TAG) },
  { accepts: isTtsPipeline, matches: hasTag(RECOMMENDED_TAG) },
  { accepts: isVadPipeline, matches: hasTag(RECOMMENDED_TAG) },
];

// What onboarding downloads: the picked chat model alone, or with the voice
// models.
export type ModelSetup = 'textOnly' | 'textAndVoice';

export const curatedOnboardingModels = (
  modelId: number,
  setup: ModelSetup,
): CuratedModel[] => [
  curatedChatModel(modelId),
  ...(setup === 'textAndVoice' ? CURATED_VOICE_ONLY_MODELS : []),
];

export const CURATED_VOICE_PIPELINE_MODELS: readonly CuratedModel[] = [
  ...CURATED_TEXT_MODELS,
  ...CURATED_VOICE_ONLY_MODELS,
];

const resolveCuratedModels = (
  curated: readonly CuratedModel[],
  catalogue: readonly Model[],
): Model[] =>
  curated.flatMap(({ accepts, matches }) => {
    const model = catalogue.find(
      candidate => accepts(candidate.pipeline) && matches(candidate),
    );

    return model ? [model] : [];
  });

// `curated` models state:
// - ready: every entry is installed.
// - inProgress: downloads on their way, running or interrupted.
// - automatic: the missing models can be downloaded in one go, and fit in RAM
// - manual: the user has to pick models from the Models screen on their own (for e.g small RAM)
// - loading: init state not known yet.
export type CuratedAvailability =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'inProgress'; downloads: readonly ModelDownload[] }
  | {
      kind: 'automatic';
      models: readonly Model[];
      sizeGB: number;
      pending: readonly ModelDownload[];
    }
  | { kind: 'manual' };

// What the device has, and what the catalogue offers it.
export interface ModelInventory {
  installed: readonly Model[];
  downloads: readonly ModelDownload[];
  inUseIds: readonly number[];
  catalogue: DeviceCatalogue | 'loading' | 'failed';
}

export const curatedAvailability = (
  curated: readonly CuratedModel[],
  { installed, downloads, inUseIds, catalogue }: ModelInventory,
): CuratedAvailability => {
  const inMemory: Model[] = [];
  const pending: ModelDownload[] = [];
  const missing: CuratedModel[] = [];

  curated.forEach(entry => {
    const candidates = installed.filter(model => fulfills(model, entry));

    if (candidates.length > 0) {
      inMemory.push(
        candidates.find(model => inUseIds.includes(model.id)) ?? candidates[0],
      );
      return;
    }

    const download = downloads.find(({ model }) => fulfills(model, entry));

    if (download) {
      inMemory.push(download.model);
      pending.push(download);
      return;
    }

    missing.push(entry);
  });

  if (missing.length === 0) {
    return pending.length > 0
      ? { kind: 'inProgress', downloads: pending }
      : { kind: 'ready' };
  }

  if (catalogue === 'loading') {
    return { kind: 'loading' };
  }

  if (catalogue === 'failed') {
    return { kind: 'manual' };
  }

  const models = resolveCuratedModels(missing, catalogue.models);

  if (
    models.length < missing.length ||
    !fitsInDeviceMemory([...inMemory, ...models], catalogue.ramGB)
  ) {
    return { kind: 'manual' };
  }

  return {
    kind: 'automatic',
    models,
    sizeGB: models.reduce((sum, model) => sum + modelDownloadSizeGB(model), 0),
    pending,
  };
};

const ONBOARDING_CHAT_TAGS = [RECOMMENDED_TAG, FIRST_PICK_TAG];

export const onboardingChatModels = ({
  models,
  ramGB,
}: DeviceCatalogue): Model[] =>
  models
    .filter(
      model =>
        isChatPipeline(model.pipeline) &&
        model.tags.some(tag => ONBOARDING_CHAT_TAGS.includes(tag)) &&
        fitsInDeviceMemory([model], ramGB),
    )
    .sort(byCatalogueOrder);
