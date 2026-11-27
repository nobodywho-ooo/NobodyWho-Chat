// Hrefs of the screens under app/routes. Route groups — (drawers), (main),
// (chat) — don't appear in a URL, so the drawer screens live at the top level.
// Sub-screens are pushed inside their menu screen's stack, never over the
// drawers: the root stack's lingering bar during a pop (react-native-screens
// patch) would shift the nested stack's header down, then snap it back up.
export const Routes = {
  chat: '/',
  models: '/models',
  settings: '/settings',
  customizeAssistant: '/settings/customize-assistant',
  language: '/settings/language',
  downloadedModels: '/downloaded-models',
  terms: '/settings/terms',
  privacyPolicy: '/settings/privacy-policy',
  acknowledgements: '/settings/acknowledgements',
  onboardingTextModel: '/onboarding/text-model',
  onboardingVoice: '/onboarding/voice',
  onboardingDownload: '/onboarding/download',
} as const;

export const DRAWER_ROUTE_NAMES = {
  chat: '(chat)',
  models: 'models',
  settings: 'settings',
} as const;
