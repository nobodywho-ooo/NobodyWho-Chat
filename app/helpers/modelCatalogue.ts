import { Model } from 'types';

export const MODELS_URL =
  'https://raw.githubusercontent.com/pielouNW/mobile-backend/refs/heads/main/v1/v1.4.1.json';

export const TIMEOUT_MS = 10000;

const UNORDERED = Number.MAX_SAFE_INTEGER;

// Sorts models the way the catalogue ranks them; unranked ones go last.
export const byCatalogueOrder = (a: Model, b: Model) =>
  (a.order ?? UNORDERED) - (b.order ?? UNORDERED);

// A shallow shape check, enough to keep a broken response
export const isModelCatalogue = (value: unknown): value is Model[] =>
  Array.isArray(value) &&
  value.every(
    entry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.id === 'number' &&
      Array.isArray(entry.parts),
  );

// The whole catalogue, whatever the device can run.
export const fetchModelCatalogue = async (): Promise<Model[]> => {
  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(MODELS_URL, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Model catalogue request failed: ${response.status}`);
    }

    const catalogue: unknown = await response.json();

    if (!isModelCatalogue(catalogue)) {
      throw new Error('Model catalogue response is not a list of models');
    }

    return catalogue;
  } finally {
    clearTimeout(timeout);
  }
};

// The catalogue, with the device RAM to judge what it can run against.
export interface DeviceCatalogue {
  models: readonly Model[];
  ramGB: number | undefined;
}
