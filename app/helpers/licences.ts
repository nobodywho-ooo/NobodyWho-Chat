import { AppLicence, ModelLicence, ServiceCredit } from 'types';
import { TIMEOUT_MS } from './modelCatalogue';

export const LICENCES_URL =
  'https://raw.githubusercontent.com/pielouNW/mobile-backend/refs/heads/main/v1/v1.4.1.licences.json';

export const APP_LICENCES: readonly AppLicence[] = [
  {
    titleKey: 'screens.acknowledgements.webSearch',
    licenceType: 'MIT',
    url: 'https://github.com/software-mansion-labs/private-mind/blob/main/LICENSE',
  },
];

export const WEB_SEARCH_PROVIDERS: readonly ServiceCredit[] = [
  {
    name: 'DuckDuckGo',
    usageKey: 'screens.acknowledgements.searchResultsAndIcons',
    url: 'https://duckduckgo.com/terms',
  },
  {
    name: 'Brave Search',
    usageKey: 'screens.acknowledgements.searchResults',
    url: 'https://brave.com/terms-of-use/',
  },
  {
    name: 'Mojeek',
    usageKey: 'screens.acknowledgements.searchResults',
    url: 'https://www.mojeek.com/about/terms.html',
  },
];

export const isModelLicenceList = (value: unknown): value is ModelLicence[] =>
  Array.isArray(value) &&
  value.every(
    entry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.id === 'number' &&
      typeof entry.modelName === 'string' &&
      typeof entry.licenceType === 'string' &&
      typeof entry.url === 'string',
  );

export const fetchModelLicences = async (): Promise<ModelLicence[]> => {
  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(LICENCES_URL, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Model licences request failed: ${response.status}`);
    }

    const licences: unknown = await response.json();

    if (!isModelLicenceList(licences)) {
      throw new Error('Model licences response is not a list of licences');
    }

    return licences;
  } finally {
    clearTimeout(timeout);
  }
};
