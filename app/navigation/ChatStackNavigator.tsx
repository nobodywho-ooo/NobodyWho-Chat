import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Message } from 'react-native-nobodywho';
import { ChatMessage } from 'types';
import {
  getModelIdInUse,
  subscribeModelIdInUse,
  getChatIdInUse,
  subscribeChatIdInUse,
} from 'database';
import { getMessagesByChatId, getModelById } from 'repositories';
import { devLog, isIOS } from 'helpers';
import { PlatformIcon } from 'components';
import { useModels, useStyled } from 'hooks';
import { useAiService } from 'services';
import {
  ChatScreen,
  DownloadedModelsScreen,
  ErrorScreen,
  LoadingScreen,
  ModelsScreen,
  NoModelDownloadedScreen,
  SettingsScreen,
} from 'screens';

const Stack = createNativeStackNavigator();

enum SessionStatus {
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}

const toChatHistory = (messages: ChatMessage[]): Message[] =>
  messages.map((message): Message => {
    switch (message.role) {
      case 'assistant':
        return { role: 'assistant', content: message.content };
      case 'system':
        return { role: 'system', content: message.content };
      case 'user':
      default:
        return { role: 'user', content: message.content };
    }
  });

export const ChatStackNavigator = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { models } = useModels();
  const { chat, createChat, disposeChat } = useAiService();

  const [status, setStatus] = useState<SessionStatus>(SessionStatus.Loading);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);

  // --- Lifecycle steps -------------------------------------------------------

  const mountModelAndCreateChat = useCallback(async () => {
    const modelIdInUse = await getModelIdInUse();
    if (modelIdInUse === undefined) {
      throw new Error('ChatStackNavigator: no model in use');
    }

    const model = await getModelById(modelIdInUse);
    if (model === undefined) {
      throw new Error(`ChatStackNavigator: model ${modelIdInUse} not found`);
    }

    await createChat({ model });
    if (chat.current === undefined) {
      throw new Error('ChatStackNavigator: chat creation failed');
    }
  }, [createChat, chat]);

  const resetAndLoadChatHistory = useCallback(async () => {
    if (chat.current === undefined) {
      throw new Error('ChatStackNavigator: chat is not ready');
    }

    const chatIdInUse = await getChatIdInUse();
    if (chatIdInUse === undefined) {
      // undefined chat id means a brand new chat.
      await chat.current.resetHistory();
      setChatHistory([]);
      return;
    }

    const messages = await getMessagesByChatId(chatIdInUse);
    const history = toChatHistory(messages);
    await chat.current.setChatHistory(history);
    setChatHistory(history);
  }, [chat]);

  // --- Lifecycle orchestrators ----------------------------------------------

  const runSession = useCallback(async (steps: () => Promise<void>) => {
    setStatus(SessionStatus.Loading);
    try {
      await steps();
      setStatus(SessionStatus.Ready);
    } catch (error) {
      devLog('ChatStackNavigator session error', error);
      setStatus(SessionStatus.Error);
    }
  }, []);

  // Full (re)initialization: model + chat + history. Used on the initial load
  // and whenever the in-use model changes (the previous chat is disposed first).
  const startSession = useCallback(
    () =>
      runSession(async () => {
        await mountModelAndCreateChat();
        await resetAndLoadChatHistory();
      }),
    [runSession, mountModelAndCreateChat, resetAndLoadChatHistory],
  );

  // History-only refresh: used when the in-use chat changes (same model/chat).
  const refreshChatHistory = useCallback(
    () => runSession(resetAndLoadChatHistory),
    [runSession, resetAndLoadChatHistory],
  );

  // --- Lifecycle triggers ----------------------------------------------------

  // Initial load.
  useEffect(() => {
    startSession();
  }, [startSession]);

  // The in-use model changed: tear down the chat and rebuild from scratch.
  useEffect(() => {
    return subscribeModelIdInUse(() => {
      disposeChat();
      startSession();
    });
  }, [disposeChat, startSession]);

  // The in-use chat changed: reload only the history into the existing chat.
  useEffect(() => {
    return subscribeChatIdInUse(() => {
      refreshChatHistory();
    });
  }, [refreshChatHistory]);

  const ErrorScreenWithRetry = useMemo(
    () => () => <ErrorScreen onRetry={startSession} />,
    [startSession],
  );

  const ChatScreenWithHistory = useMemo(
    () => () => <ChatScreen messages={chatHistory} />,
    [chatHistory],
  );

  const screen = useMemo(() => {
    if (models.length === 0) {
      return NoModelDownloadedScreen;
    }

    switch (status) {
      case SessionStatus.Ready:
        return ChatScreenWithHistory;
      case SessionStatus.Error:
        return ErrorScreenWithRetry;
      case SessionStatus.Loading:
      default:
        return LoadingScreen;
    }
  }, [models.length, status, ChatScreenWithHistory, ErrorScreenWithRetry]);

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
