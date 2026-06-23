import 'i18n';
import React, { useCallback, useEffect } from 'react';
import { useState } from 'react';
import { Platform, StatusBar } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { ThemeProvider, isDarkModeEnabled } from 'context';
import {
  initDatabase,
  hydrateAppState,
  getAppState,
  setAppState,
} from 'database';
import {
  clearRunningDownloads,
  getConversationById,
  getModelById,
} from 'repositories';
import { log } from 'helpers';
import { useStyled } from 'hooks';
import { ErrorScreen, LoadingScreen } from 'screens';
import { AiServiceProvider } from 'services';
import { DrawerNavigator } from 'navigation';
import { useTranslation } from 'react-i18next';

Sentry.init({
  dsn: 'https://5901cf2e433ebe444dd4dc9f8aebc790@o4511569171709952.ingest.de.sentry.io/4511569173217360',
  sendDefaultPii: true,
  tracesSampleRate: __DEV__ ? 1.0 : 1.0, // TODO: Reminder - Decrease later on for prod
  profilesSampleRate: __DEV__ ? 0 : 1.0,
  replaysOnErrorSampleRate: __DEV__ ? 0 : 1.0,
  replaysSessionSampleRate: __DEV__ ? 0 : 1.0, // TODO: Reminder - Decrease later on for prod
  enableLogs: true,
  integrations: [
    ...(__DEV__
      ? []
      : [
          Sentry.mobileReplayIntegration({
            maskAllText: true,
            maskAllImages: true,
          }),
        ]),
    Sentry.reactNavigationIntegration({
      enableTimeToInitialDisplay: true,
    }),
  ],
  enableNativeFramesTracking: true,
  environment: __DEV__ ? 'development' : 'production',
  debug: false,
  beforeBreadcrumb(breadcrumb) {
    // TODO: hot fix, delete when fix in future sentry version
    // On Android the native bridge (sentry-java) deserializes the breadcrumb
    // timestamp as a String, but React Native's toHashMap() converts the JS
    // numeric (epoch seconds) timestamp into a Double, which throws
    // "java.lang.Double cannot be cast to java.lang.String" and drops the
    // breadcrumb. Send an ISO string instead — accepted by both Sentry ingest
    // and the native deserializer. iOS reads it as a number, so leave it alone.
    if (Platform.OS === 'android' && typeof breadcrumb.timestamp === 'number') {
      // @ts-expect-error Sentry types timestamp as number; ISO8601 strings are valid for ingest.
      breadcrumb.timestamp = new Date(
        breadcrumb.timestamp * 1000,
      ).toISOString();
    }
    return breadcrumb;
  },
});

function AppContent() {
  const { colors } = useStyled();
  const isDarkMode = isDarkModeEnabled();

  const navigationTheme = {
    ...(isDarkMode ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDarkMode ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.surface,
    },
  };

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <Sentry.NavigationContainer theme={navigationTheme}>
        <DrawerNavigator />
      </Sentry.NavigationContainer>
    </>
  );
}

// Hydrated state can point at rows that no longer exist (model deleted,
// database reset). Clear stale ids so the app degrades to the select-a-model
// or empty-chat flows instead of dead-ending on the error screen.
async function dropStaleIdsInUse(): Promise<void> {
  const { modelIdInUse, conversationIdInUse } = getAppState();

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

function AppLoader() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(false);
  const { t } = useTranslation();

  const init = useCallback(async () => {
    setDbError(false);
    setDbReady(false);

    setAudioModeAsync({ playsInSilentMode: true }).catch(error =>
      log('AppLoader setAudioModeAsync failed', error),
    );

    try {
      await initDatabase();
      await clearRunningDownloads();
      await hydrateAppState();
      await dropStaleIdsInUse();

      Sentry.appLoaded();
      setDbReady(true);
    } catch (error) {
      log('App init failed', error, { capture: true });
      setDbError(true);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  if (dbError) return <ErrorScreen onRetry={init} />;
  if (!dbReady)
    return <LoadingScreen message={t('screens.loadingScreen.loadingApp')} />;

  return (
    <AiServiceProvider>
      <AppContent />
    </AiServiceProvider>
  );
}

export default Sentry.wrap(function App() {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppLoader />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});
