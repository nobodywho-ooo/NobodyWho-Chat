import * as React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useTheme, ThemeProvider } from 'context';
import { BottomTabNavigator } from 'navigation';
import { AiServiceProvider } from 'services';

function AppContent() {
  const theme = useTheme();

  return (
    <>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <NavigationContainer>
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
