import {
  isChatPipeline,
  isSttPipeline,
  isTtsPipeline,
  isVadPipeline,
  Model,
  ModelPipeline,
} from 'types';

export const RECOMMENDED_TAG = 'Recommended';
export const FIRST_PICK_TAG = 'Great First Pick';

export interface CuratedModel {
  accepts: (pipeline: ModelPipeline) => boolean;
  matches: (model: Model) => boolean;
  exactMatch?: boolean;
}

// Whether `model`, installed or downloading, already takes care of `curated`.
export const fulfills = (model: Model, curated: CuratedModel): boolean =>
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

export const CURATED_VOICE_PIPELINE_MODELS: readonly CuratedModel[] = [
  ...CURATED_TEXT_MODELS,
  ...CURATED_VOICE_ONLY_MODELS,
];

export const resolveCuratedModels = (
  curated: readonly CuratedModel[],
  catalogue: readonly Model[],
): Model[] =>
  curated.flatMap(({ accepts, matches }) => {
    const model = catalogue.find(
      candidate => accepts(candidate.pipeline) && matches(candidate),
    );

    return model ? [model] : [];
  });
