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
import { initDatabase, setModelIdInUse } from 'database';
import { insertModel } from 'repositories';
import { ModelPipeline } from 'types';
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

function AppLoader() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(false);

  const init = useCallback(async () => {
    setDbError(false);
    setDbReady(false);
    try {
      await initDatabase();

      if (__DEV__) {
        // Create and set local model
        await insertModel({
          id: 0,
          modelName: 'chat-model',
          modelSizeGB: 0.5,
          parameterCountBillions: 0.6,
          author: 'Alibaba Cloud',
          family: 'Qwen',
          thinking: true,
          imageIngestion: false,
          audioIngestion: false,
          downloadLinks: [],
          pipeline: ModelPipeline.textGeneration,
          tags: [],
        });

        await setModelIdInUse(0);
      }

      setDbReady(true);
    } catch {
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
