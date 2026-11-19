import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import {
  CustomizeAssistantScreen,
  DownloadedModelsScreen,
  LanguageScreen,
  PrivacyPolicyScreen,
  TermsScreen,
} from 'screens';

import { RootDrawerNavigator } from './RootDrawerNavigator';
import { DrawerCoordinationProvider } from './DrawerCoordination';

const Stack = createNativeStackNavigator();

// The app's root: the drawers (chat / models / settings on the left, voice
// assistant on the right) are the first screen, and the secondary screens are
// pushed above them — over the whole drawer, header included — so a push never
// touches the drawer's header. Screens navigate here by name (e.g.
// 'TermsScreen'); the action bubbles up from whichever drawer screen sends it.
const RootStack = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const screenOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.onSurface,
      headerTitleStyle: { color: colors.onSurface },
      headerBackButtonDisplayMode: 'minimal' as const,
    }),
    [colors.surface, colors.onSurface],
  );

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Drawers"
        component={RootDrawerNavigator}
        // Stays live under a pushed screen: the chat session reacts to model and
        // settings changes made there, and expo-audio crashes when paused.
        options={{ headerShown: false, inactiveBehavior: 'none' }}
      />
      <Stack.Screen
        name="CustomizeAssistantScreen"
        component={CustomizeAssistantScreen}
        options={{ title: t('navigation.customizeAssistant') }}
      />
      <Stack.Screen
        name="LanguageScreen"
        component={LanguageScreen}
        options={{ title: t('navigation.language') }}
      />
      <Stack.Screen
        name="DownloadedModelsScreen"
        component={DownloadedModelsScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="TermsScreen"
        component={TermsScreen}
        options={{ title: t('navigation.terms') }}
      />
      <Stack.Screen
        name="PrivacyPolicyScreen"
        component={PrivacyPolicyScreen}
        options={{ title: t('navigation.privacyPolicy') }}
      />
    </Stack.Navigator>
  );
};

export const RootNavigator = () => (
  <DrawerCoordinationProvider>
    <RootStack />
  </DrawerCoordinationProvider>
);
