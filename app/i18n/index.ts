import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { findBestLanguageTag } from 'react-native-localize';

import { getStorage } from '../database/storage';
import { log } from '../helpers/log';
import en from './locales/en.json';
import da from './locales/da.json';
import fr from './locales/fr.json';

export const APP_LANGUAGES = ['en', 'da', 'fr'] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const APP_LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: 'English',
  da: 'Dansk',
  fr: 'Français',
};

const LANGUAGE_STORAGE_KEY = 'app_language';

const isAppLanguage = (value: unknown): value is AppLanguage =>
  APP_LANGUAGES.includes(value as AppLanguage);

export const getDeviceLanguage = (): AppLanguage => {
  const best = findBestLanguageTag(APP_LANGUAGES)?.languageTag;
  return isAppLanguage(best) ? best : 'en';
};

/** The language the user picked, or undefined to follow the device. */
export const getLanguagePreference = (): AppLanguage | undefined => {
  try {
    const saved = getStorage().getItemSync(LANGUAGE_STORAGE_KEY);

    return isAppLanguage(saved) ? saved : undefined;
  } catch (error) {
    log('i18n read language preference failed', error);
    return undefined;
  }
};

/** Saves the choice for the next launches; undefined follows the device. */
export const setLanguagePreference = (language: AppLanguage | undefined) => {
  try {
    if (language) {
      getStorage().setItemSync(LANGUAGE_STORAGE_KEY, language);
    } else {
      getStorage().removeItemSync(LANGUAGE_STORAGE_KEY);
    }
  } catch (error) {
    log('i18n save language preference failed', error);
  }

  i18n.changeLanguage(language ?? getDeviceLanguage());
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    da: { translation: da },
    fr: { translation: fr },
  },
  lng: getLanguagePreference() ?? getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
