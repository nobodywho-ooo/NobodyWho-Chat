import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useStyled } from 'hooks';
import { AiModelState, useAiService } from 'services';
import {
  ChatScreen,
  ErrorScreen,
  LoadingScreen,
  NoModelDownloadedScreen,
} from 'screens';

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
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
};
