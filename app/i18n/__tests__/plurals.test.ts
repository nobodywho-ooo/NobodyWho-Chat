import i18next from 'i18next';

import en from '../locales/en.json';
import da from '../locales/da.json';

// The app's own instance reads the device locale through a native module, so
// build one from the same resources.
const i18n = i18next.createInstance();

beforeAll(() =>
  i18n.init({
    resources: { en: { translation: en }, da: { translation: da } },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  }),
);

const sizes = { required: '4 GB', available: '1 GB' };

test.each(['en', 'da'])(
  'names the model when one does not fit, stays generic for several (%s)',
  lng => {
    const one = i18n.t('screens.models.notEnoughSpaceMessage', {
      lng,
      count: 1,
      name: 'LFM2.5',
      ...sizes,
    });
    const several = i18n.t('screens.models.notEnoughSpaceMessage', {
      lng,
      count: 4,
      name: 'LFM2.5',
      ...sizes,
    });

    expect(one).toContain('LFM2.5');
    expect(several).not.toContain('LFM2.5');
    expect(several).toContain('4 GB');
    expect(several).not.toContain('{{');
  },
);
