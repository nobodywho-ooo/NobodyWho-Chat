import React, { useCallback } from 'react';
import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { ThemeProvider, isDarkModeEnabled } from 'context';
import { initDatabase } from 'helpers';
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

  const init = useCallback(() => {
    setDbError(false);
    setDbReady(false);
    initDatabase()
      .then(() => setDbReady(true))
      .catch(() => setDbError(true));
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
    <ThemeProvider>
      <AppLoader />
    </ThemeProvider>
  );
}
