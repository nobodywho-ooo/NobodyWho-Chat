import i18next from 'i18next';

import en from '../../../i18n/locales/en.json';

const i18n = i18next.createInstance();

i18n.init({
  lng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
  initAsync: false,
});

export const t = i18n.t.bind(i18n);
