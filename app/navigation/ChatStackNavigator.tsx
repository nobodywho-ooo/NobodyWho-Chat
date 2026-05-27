import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { IconButton, PlatformIcon } from 'components';
import { useStyled } from 'hooks';
import { AiModelState, useAiService } from 'services';
import {
  ChatScreen,
  DownloadedModelsScreen,
  ErrorScreen,
  LoadingScreen,
  ModelsScreen,
  NoModelDownloadedScreen,
  SettingsScreen,
} from 'screens';
import { Pressable } from 'react-native';

const Stack = createNativeStackNavigator();

export const ChatStackNavigator = () => {
  const { colors } = useStyled();
  const { chatState, createChat } = useAiService();

  const initChat = useCallback(async () => {
    await createChat();
  }, [createChat]);

  useEffect(() => {
    initChat();
  }, [initChat]);

  const ErrorScreenWithRetry = useMemo(
    () => () => <ErrorScreen onRetry={initChat} />,
    [initChat],
  );

  let screen = LoadingScreen;

  switch (chatState) {
    case AiModelState.Ready:
      screen = ChatScreen;
      break;
    case AiModelState.Error:
      screen = ErrorScreenWithRetry;
      break;
    default:
      screen = LoadingScreen;
  }

  screen = NoModelDownloadedScreen;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface },
      }}
    >
      <Stack.Screen
        name="ChatScreen"
        component={screen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SettingsScreen"
        component={SettingsScreen}
        options={({ navigation }) => ({
          title: 'Settings',
          presentation: 'modal',
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()}>
              <PlatformIcon
                iosIconName={'xmark'}
                androidIconName={'close'}
                color={colors.onSurface}
                size={22}
              />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="ModelsScreen"
        component={ModelsScreen}
        options={({ navigation }) => ({
          title: 'Models',
          presentation: 'modal',
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()}>
              <PlatformIcon
                iosIconName={'xmark'}
                androidIconName={'close'}
                color={colors.onSurface}
                size={22}
              />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="DownloadedModelsScreen"
        component={DownloadedModelsScreen}
        options={{ title: 'Downloaded Models' }}
      />
    </Stack.Navigator>
  );
};
