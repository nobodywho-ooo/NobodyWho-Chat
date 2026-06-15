import 'i18n';
import React, { useCallback } from 'react';
import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { ThemeProvider, isDarkModeEnabled } from 'context';
import {
  initDatabase,
  hydrateAppState,
  getAppState,
  setAppState,
} from 'database';
import { getConversationById, getModelById, insertModel } from 'repositories';
import { ModelPipeline } from 'types';
import { devLog } from 'helpers';
import { useStyled } from 'hooks';
import { ErrorScreen, LoadingScreen } from 'screens';
import { AiServiceProvider } from 'services';
import { DrawerNavigator } from 'navigation';

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
      <NavigationContainer theme={navigationTheme}>
        <DrawerNavigator />
      </NavigationContainer>
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

  const init = useCallback(async () => {
    setDbError(false);
    setDbReady(false);
    try {
      await initDatabase();
      await hydrateAppState();

      // TODO: delete this if when model download is working
      if (__DEV__) {
        if ((await getModelById(0)) === undefined) {
          await insertModel({
            id: 0,
            modelName: 'Qwen3',
            modelSizeGB: 0.5,
            parameterCountBillions: 0.6,
            author: 'Alibaba Cloud',
            family: 'qwen3',
            thinking: true,
            imageIngestion: false,
            audioIngestion: false,
            downloadLinks: [],
            pipeline: ModelPipeline.textGeneration,
            tags: ['Smart'],
          });
          await insertModel({
            id: 1,
            modelName: 'Bonsai',
            modelSizeGB: 0.25,
            parameterCountBillions: 1.7,
            author: 'Prism ML',
            family: 'bonsai',
            thinking: false,
            imageIngestion: false,
            audioIngestion: false,
            downloadLinks: [],
            pipeline: ModelPipeline.textGeneration,
            tags: ['Dense'],
          });
        }
      }

      await dropStaleIdsInUse();

      setDbReady(true);
    } catch (error) {
      devLog('App init failed', error);
      setDbError(true);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  if (dbError) return <ErrorScreen onRetry={init} />;
  if (!dbReady) return <LoadingScreen />;

  return (
    <AiServiceProvider>
      <AppContent />
    </AiServiceProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppLoader />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
