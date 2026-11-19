import { useSyncExternalStore } from 'react';
import { getStorage } from 'database';
import {
  DeviceCatalogue,
  deviceRamGB,
  fetchModelCatalogue,
  isModelCatalogue,
  log,
  MODELS_URL,
} from 'helpers';
import { Model } from 'types';

// One copy of the model catalogue for the whole app (Models screen, onboarding,
// the curated download sheets), kept in memory and on disk:
// - refreshed in the background at every cold start (prefetchModelCatalogue),
//   so screens rarely wait on the network;
// - fresh for CATALOGUE_FRESH_MS: used as is;
// - stale until CATALOGUE_EXPIRY_MS: still shown, refreshed behind it;
// - expired after that: never shown before a fetch is tried, but still the
//   fallback when that fetch fails (offline).
// The stored copy remembers the URL it came from, so pointing MODELS_URL at a
// new catalogue version drops it.

export const CATALOGUE_FRESH_MS = 24 * 60 * 60 * 1000;
export const CATALOGUE_EXPIRY_MS = 30 * CATALOGUE_FRESH_MS;

export const CATALOGUE_STORAGE_KEY = 'modelCatalogue';

interface CachedCatalogue {
  models: Model[];
  fetchedAt: number;
}

interface StoredCatalogue extends CachedCatalogue {
  url: string;
}

export interface CatalogueSnapshot {
  catalogue: DeviceCatalogue | undefined;
  isFetching: boolean;
  hasFailed: boolean;
}

// undefined: the disk copy hasn't been read yet; null: there is none.
let cached: CachedCatalogue | null | undefined;
let request: Promise<CachedCatalogue> | undefined;
let hasFailed = false;

let ramGB: { value: number | undefined } | undefined;
let ramRequest: Promise<number | undefined> | undefined;

const listeners = new Set<() => void>();
let snapshot: CatalogueSnapshot | undefined;

const ageOf = (catalogue: CachedCatalogue) => Date.now() - catalogue.fetchedAt;

const readStored = (): CachedCatalogue | null => {
  try {
    const raw = getStorage().getItemSync(CATALOGUE_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const stored: Partial<StoredCatalogue> = JSON.parse(raw);

    if (
      stored.url !== MODELS_URL ||
      typeof stored.fetchedAt !== 'number' ||
      !isModelCatalogue(stored.models)
    ) {
      return null;
    }

    return { models: stored.models, fetchedAt: stored.fetchedAt };
  } catch (error) {
    log('catalogueStore readStored', error);
    return null;
  }
};

const writeStored = (catalogue: CachedCatalogue) => {
  try {
    const stored: StoredCatalogue = { ...catalogue, url: MODELS_URL };
    getStorage().setItemSync(CATALOGUE_STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    log('catalogueStore writeStored', error);
  }
};

const currentCatalogue = (): CachedCatalogue | null => {
  if (cached === undefined) {
    cached = readStored();
  }

  return cached;
};

const buildSnapshot = (): CatalogueSnapshot => {
  const current = currentCatalogue();
  const isShowable =
    current !== null &&
    ramGB !== undefined &&
    (ageOf(current) < CATALOGUE_EXPIRY_MS || hasFailed);

  return {
    catalogue: isShowable
      ? { models: current.models, ramGB: ramGB!.value }
      : undefined,
    isFetching: request !== undefined,
    hasFailed,
  };
};

const notify = () => {
  snapshot = buildSnapshot();
  listeners.forEach(listener => listener());
};

const loadDeviceRam = (): Promise<number | undefined> => {
  if (ramRequest === undefined) {
    ramRequest = deviceRamGB().then(value => {
      ramGB = { value };
      notify();
      return value;
    });
  }

  return ramRequest;
};

// Always goes to the network; concurrent callers share one request.
export const refreshModelCatalogue = (): Promise<CachedCatalogue> => {
  if (request === undefined) {
    request = fetchModelCatalogue()
      .then(
        models => {
          const next = { models, fetchedAt: Date.now() };
          cached = next;
          hasFailed = false;
          writeStored(next);
          return next;
        },
        error => {
          hasFailed = true;
          throw error;
        },
      )
      .finally(() => {
        request = undefined;
        notify();
      });

    notify();
  }

  return request;
};

// The catalogue, from cache when it can (see the header for the rules).
export const getModelCatalogue = async (): Promise<readonly Model[]> => {
  const current = currentCatalogue();

  if (current !== null) {
    const age = ageOf(current);

    if (age < CATALOGUE_FRESH_MS) {
      return current.models;
    }

    if (age < CATALOGUE_EXPIRY_MS) {
      refreshModelCatalogue().catch(error =>
        log('catalogueStore background refresh', error),
      );
      return current.models;
    }
  }

  try {
    return (await refreshModelCatalogue()).models;
  } catch (error) {
    if (current !== null) {
      return current.models;
    }
    throw error;
  }
};

// The catalogue with the device RAM to judge what it can run against.
export const getDeviceCatalogue = async (): Promise<DeviceCatalogue> => {
  const [models, ram] = await Promise.all([
    getModelCatalogue(),
    loadDeviceRam(),
  ]);

  return { models, ramGB: ram };
};

// Fire and forget, at every cold start.
export const prefetchModelCatalogue = () => {
  loadDeviceRam();
  refreshModelCatalogue().catch(error => log('catalogueStore prefetch', error));
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  loadDeviceRam();

  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): CatalogueSnapshot => {
  if (snapshot === undefined) {
    snapshot = buildSnapshot();
  }

  return snapshot;
};

// Follows the cached catalogue; fetches nothing by itself.
export const useModelCatalogue = (): CatalogueSnapshot =>
  useSyncExternalStore(subscribe, getSnapshot);

// Tests only: forget everything held in memory (the disk copy is re-read).
export const resetModelCatalogueForTests = () => {
  cached = undefined;
  request = undefined;
  hasFailed = false;
  ramGB = undefined;
  ramRequest = undefined;
  snapshot = undefined;
  listeners.clear();
};
