import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { setAudioModeAsync } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
  useNavigationContainerRef,
} from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as Sentry from '@sentry/react-native';
import { ThemeProvider, isDarkModeEnabled } from 'context';
import {
  initDatabase,
  resetDatabase,
  hydrateAppState,
  getAppState,
  setAppState,
} from 'database';
import {
  getAllModels,
  getConversationById,
  getModelById,
  getModelDownloads,
} from 'repositories';
import { log } from 'helpers';
import { isChatPipeline, MODEL_SLOTS } from 'types';
import { useResumeModelDownloads, useStyled } from 'hooks';
import { ErrorScreen, LogoLoadingScreen } from 'screens';
import { WebScrapeHost } from 'components';
import { AiServiceProvider, prefetchModelCatalogue } from 'services';
import { OnboardingFinishContext, navigationIntegration } from 'navigation';

// The app's root: the drawers (chat / models / settings on the left, voice
// assistant on the right). Each menu screen pushes its own sub-screens in its
// own native stack (see Routes). Onboarding replaces all of it until it
// finishes.
const RootStack = ({ showOnboarding }: { showOnboarding: boolean }) => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={showOnboarding}>
      <Stack.Screen name="onboarding" options={{ animation: 'none' }} />
    </Stack.Protected>
    <Stack.Protected guard={!showOnboarding}>
      <Stack.Screen name="(drawers)" options={{ animation: 'none' }} />
    </Stack.Protected>
  </Stack>
);

interface AppContentProps {
  showOnboarding: boolean;
  onOnboardingFinish: () => void;
}

function AppContent({ showOnboarding, onOnboardingFinish }: AppContentProps) {
  const { colors } = useStyled();
  const isDarkMode = isDarkModeEnabled();

  const navigationTheme = useMemo(() => {
    const base = isDarkMode ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: colors.surface },
    };
  }, [isDarkMode, colors.surface]);

  useResumeModelDownloads({ alertOnFailure: !showOnboarding });

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <OnboardingFinishContext.Provider value={onOnboardingFinish}>
        <RootStack showOnboarding={showOnboarding} />
      </OnboardingFinishContext.Provider>
      {!showOnboarding && <WebScrapeHost />}
    </NavigationThemeProvider>
  );
}

// Hydrated state can point at rows that no longer exist (model deleted,
// database reset). Clear stale ids so the app degrades to the select-a-model
// or empty-chat flows instead of dead-ending on the error screen.
async function dropStaleIdsInUse(): Promise<void> {
  const state = getAppState();

  for (const { appStateKey } of MODEL_SLOTS) {
    if (appStateKey === 'modelIdInUse') {
      continue; // handle bellow for loop
    }

    const modelId = state[appStateKey];

    if (modelId !== undefined && (await getModelById(modelId)) === undefined) {
      await setAppState({ [appStateKey]: undefined });
    }
  }

  const { modelIdInUse, conversationIdInUse } = state;

  if (
    modelIdInUse !== undefined &&
    (await getModelById(modelIdInUse)) === undefined
  ) {
    await setAppState({
      modelIdInUse: undefined,
      conversationIdInUse: undefined,
    });
    return;
  }

  if (conversationIdInUse === undefined) {
    return;
  }

  const conversation = await getConversationById(conversationIdInUse);
  if (conversation === undefined || conversation.modelId !== modelIdInUse) {
    await setAppState({ conversationIdInUse: undefined });
  }
}

// Onboarding shows when no chat model is downloaded or in download.
async function needsOnboarding(): Promise<boolean> {
  if (getAppState().modelIdInUse !== undefined) {
    return false;
  }

  try {
    const [models, downloads] = await Promise.all([
      getAllModels(),
      getModelDownloads(),
    ]);

    return (
      !models.some(model => isChatPipeline(model.pipeline)) &&
      !downloads.some(download => isChatPipeline(download.model.pipeline))
    );
  } catch (error) {
    log('needsOnboarding failed', error, { capture: true });
    return false;
  }
}

function AppLoader() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  const running = useRef(false);

  const finishIntro = useCallback(() => setIntroDone(true), []);

  const finishOnboarding = useCallback(() => setShowOnboarding(false), []);

  const init = useCallback(async () => {
    if (running.current) {
      return;
    }
    running.current = true;

    setDbError(false);
    setDbReady(false);

    setAudioModeAsync({ playsInSilentMode: true }).catch(error =>
      log('AppLoader setAudioModeAsync failed', error),
    );

    prefetchModelCatalogue();

    try {
      await initDatabase();
      await hydrateAppState();
      await dropStaleIdsInUse();
      setShowOnboarding(await needsOnboarding());

      Sentry.appLoaded();
      setDbReady(true);
    } catch (error) {
      log('App init failed', error, { capture: true });
      setDbError(true);
    } finally {
      running.current = false;
    }
  }, []);

  const reset = useCallback(async () => {
    if (running.current) {
      return;
    }
    running.current = true;

    setDbError(false);
    setDbReady(false);
    try {
      await resetDatabase();
    } catch (error) {
      log('App reset failed', error, { capture: true });
    } finally {
      running.current = false;
    }
    init();
  }, [init]);

  useEffect(() => {
    init();
  }, [init]);

  if (dbError) {
    return <ErrorScreen onRetry={init} onReset={reset} />;
  }

  if (!dbReady || !introDone) {
    return <LogoLoadingScreen onAnimationEnd={finishIntro} />;
  }

  return (
    <AiServiceProvider>
      <AppContent
        showOnboarding={showOnboarding}
        onOnboardingFinish={finishOnboarding}
      />
    </AiServiceProvider>
  );
}

export default function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  return (
    <GestureHandlerRootView>
      <KeyboardProvider>
        <ThemeProvider>
          <AppLoader />
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
