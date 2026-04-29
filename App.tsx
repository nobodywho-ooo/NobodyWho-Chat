import * as React from 'react';
import { StatusBar } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { ThemeProvider, isDarkModeEnabled } from 'context';
import { useStyled } from 'hooks';
import { BottomTabNavigator } from 'navigation';
import { AiServiceProvider } from 'services';

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
        <BottomTabNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AiServiceProvider>
        <AppContent />
      </AiServiceProvider>
    </ThemeProvider>
  );
}
