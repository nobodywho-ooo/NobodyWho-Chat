import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PlatformIcon } from 'components';
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
import { useTranslation } from 'react-i18next';
import { isIOS } from 'helpers';

const Stack = createNativeStackNavigator();

export const ChatStackNavigator = () => {
  const { t } = useTranslation();
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

  const renderCloseButton = useCallback(
    (navigation: { goBack: () => void }) =>
      isIOS && (
        <Pressable onPress={navigation.goBack}>
          <PlatformIcon
            iosIconName={'xmark'}
            androidIconName={'close'}
            color={colors.onSurface}
            size={22}
          />
        </Pressable>
      ),
    [colors.onSurface],
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

  //TODO: wip
  screen = ChatScreen;

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
          title: t('navigation.settings'),
          presentation: 'modal',
          headerRight: () => renderCloseButton(navigation),
        })}
      />
      <Stack.Screen
        name="ModelsScreen"
        component={ModelsScreen}
        options={({ navigation }) => ({
          title: t('navigation.models'),
          presentation: 'modal',
          headerRight: () => renderCloseButton(navigation),
        })}
      />
      <Stack.Screen
        name="DownloadedModelsScreen"
        component={DownloadedModelsScreen}
        options={({ navigation }) => ({
          title: t('navigation.downloadModels'),
          presentation: 'modal',
          headerRight: () => renderCloseButton(navigation),
        })}
      />
    </Stack.Navigator>
  );
};
