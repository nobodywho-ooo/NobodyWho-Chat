import { Platform } from 'react-native';
import { modelRequiredMemoryGB } from 'helpers';
import type { Model } from 'types';

import { WEB_FETCH_TOP_N_CONTENT, WEB_RETRIEVAL_TOP_K } from './constants/web';

export type WebPlannerMode = 'llm' | 'verbatim';

// How the web pipeline treats a given chat model. private-mind keeps a
// hand-measured table per model; our catalogue is remote and changes without
// an app release, so the profile is derived from the model's size instead,
// using the thresholds private-mind's measurements landed on.
export interface ModelProfile {
  webPlanner: WebPlannerMode;
  contextWindowTokens: number;
  generationReserveTokens: number;
  webRetrievalTopK: number;
  webFetchTopNContent: number;
  webEmbeddingRetrieval: boolean;
  webSearchReady: boolean;
}

export type WebModel = Pick<
  Model,
  'name' | 'family' | 'parameterCountBillions' | 'parts' | 'sizeGB'
> & {
  // The context the chat was actually created with, which is what the prompt
  // has to fit in (the catalogue doesn't carry it).
  contextWindowTokens?: number;
};

const DEFAULT_CONTEXT_WINDOW_TOKENS = 2048;

export const GENERATION_RESERVE_SHARE = 0.25;
export const GENERATION_RESERVE_MIN_TOKENS = 256;

export const scaledGenerationReserve = (contextWindowTokens: number): number =>
  Math.max(
    GENERATION_RESERVE_MIN_TOKENS,
    Math.round(contextWindowTokens * GENERATION_RESERVE_SHARE),
  );

// Below this the models answered from the retrieved context less often than it
// held the answer (private-mind: Qwen 2.5 0.5B, LFM 2.5 VL 450M), so search
// only made confident wrong answers look sourced.
export const WEB_SEARCH_MIN_PARAMETERS_B = 0.7;

// Below this the JSON search plan rarely parsed (Qwen 3 0.6B 2/72, 1.7B 11/72)
// and, when it did, mutated the entity searched for; those models search the
// user's own words instead.
export const LLM_PLANNER_MIN_PARAMETERS_B = 2;

const knownSize = (model: WebModel): number | undefined =>
  model.parameterCountBillions > 0 ? model.parameterCountBillions : undefined;

export const getModelProfile = (
  model: WebModel | null | undefined,
): ModelProfile => {
  const contextWindowTokens =
    model?.contextWindowTokens ?? DEFAULT_CONTEXT_WINDOW_TOKENS;
  const size = model ? knownSize(model) : undefined;

  return {
    webPlanner:
      size !== undefined && size >= LLM_PLANNER_MIN_PARAMETERS_B
        ? 'llm'
        : 'verbatim',
    contextWindowTokens,
    generationReserveTokens: scaledGenerationReserve(contextWindowTokens),
    webRetrievalTopK: WEB_RETRIEVAL_TOP_K,
    webFetchTopNContent: WEB_FETCH_TOP_N_CONTENT,
    webEmbeddingRetrieval: true,
    webSearchReady: size === undefined || size >= WEB_SEARCH_MIN_PARAMETERS_B,
  };
};

export const isWebSearchReady = (model: WebModel | null | undefined): boolean =>
  getModelProfile(model).webSearchReady;

const OS_RESERVED_GB = Platform.OS === 'ios' ? 2 : 3;

// What a search adds on top of the chat model: the scrape WebView, the fetched
// pages and their chunks. The embedding model is budgeted on its own.
export const WEB_SEARCH_MEMORY_GB = 0.3;

// Headroom (device RAM minus the chat model) under which the pipeline runs in
// its low-memory mode: no embedding re-rank and lighter page reads.
const LOW_MEMORY_HEADROOM_GB = Platform.OS === 'ios' ? 4 : 6.5;

// Device RAM unknown ⇒ assume it fits, as the rest of the app does.
export const hasMemoryForWebSearch = (
  model: WebModel | null | undefined,
  ramGB: number | undefined,
): boolean =>
  !model ||
  ramGB === undefined ||
  modelRequiredMemoryGB(model as Model) + WEB_SEARCH_MEMORY_GB <=
    ramGB - OS_RESERVED_GB;

export const isMemoryConstrained = (
  model: WebModel | null | undefined,
  ramGB: number | undefined,
): boolean =>
  !!model &&
  ramGB !== undefined &&
  ramGB - modelRequiredMemoryGB(model as Model) < LOW_MEMORY_HEADROOM_GB;

// Whether the embedding model fits beside the chat model and the search.
export const hasMemoryForEmbeddings = (
  model: WebModel | null | undefined,
  embeddingModel: Pick<Model, 'parts'> | undefined,
  ramGB: number | undefined,
): boolean =>
  !!embeddingModel &&
  (!model ||
    ramGB === undefined ||
    modelRequiredMemoryGB(model as Model) +
      modelRequiredMemoryGB(embeddingModel as Model) +
      WEB_SEARCH_MEMORY_GB <=
      ramGB - OS_RESERVED_GB);
