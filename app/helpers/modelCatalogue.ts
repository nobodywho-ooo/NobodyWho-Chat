import { Model } from 'types';
import { deviceRamGB } from './deviceMemory';

export const MODELS_URL =
  'https://raw.githubusercontent.com/pielouNW/mobile-backend/refs/heads/main/v1/v1.2.0.json';

export const TIMEOUT_MS = 10000;

const UNORDERED = Number.MAX_SAFE_INTEGER;

// Sorts models the way the catalogue ranks them; unranked ones go last.
export const byCatalogueOrder = (a: Model, b: Model) =>
  (a.order ?? UNORDERED) - (b.order ?? UNORDERED);

// The whole catalogue, whatever the device can run.
export const fetchModelCatalogue = async (): Promise<Model[]> => {
  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(MODELS_URL, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Model catalogue request failed: ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

// The catalogue, with the device RAM to judge what it can run against.
export interface DeviceCatalogue {
  models: readonly Model[];
  ramGB: number | undefined;
}

export const fetchDeviceCatalogue = async (): Promise<DeviceCatalogue> => {
  const [models, ramGB] = await Promise.all([
    fetchModelCatalogue(),
    deviceRamGB(),
  ]);

  return { models, ramGB };
};
