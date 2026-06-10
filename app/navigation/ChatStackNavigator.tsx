import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Message } from 'react-native-nobodywho';
import { ChatMessage } from 'types';
import { getAppState, setAppState, subscribeAppState } from 'database';
import {
  getConversationById,
  getMessagesByConversationId,
  getModelById,
} from 'repositories';
import { devLog, isIOS } from 'helpers';
import { PlatformIcon } from 'components';
import { useAppState, useModels, useStyled } from 'hooks';
import { useAiService } from 'services';
import {
  ChatScreen,
  DownloadedModelsScreen,
  ErrorScreen,
  LoadingScreen,
  ModelsScreen,
  NoModelDownloadedScreen,
  NoModelSelectedScreen,
  SettingsScreen,
} from 'screens';

const Stack = createNativeStackNavigator();

enum SessionStatus {
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}

type LoadedConversationId = number | undefined;

const toChatHistory = (messages: ChatMessage[]): Message[] =>
  messages.map((message): Message => {
    switch (message.role) {
      case 'assistant':
        // TODO: fix in NW - toolCalls needs to be provided otherwise setChatHistory crash
        return { role: 'assistant', content: message.content, toolCalls: [] };
      case 'system':
        return { role: 'system', content: message.content };
      case 'user':
      default:
        return { role: 'user', content: message.content };
    }
  });

interface ChatRootContextValue {
  hasModels: boolean;
  modelIdInUse: number | undefined;
  status: SessionStatus;
  chatHistory: Message[];
  conversationId: LoadedConversationId;
  onConversationCreated: (id: number) => void;
  onRetry: () => void;
}

const defaultChatRootValue: ChatRootContextValue = {
  hasModels: false,
  modelIdInUse: undefined,
  status: SessionStatus.Loading,
  chatHistory: [],
  conversationId: undefined,
  onConversationCreated: () => undefined,
  onRetry: () => undefined,
};

const ChatRootContext =
  createContext<ChatRootContextValue>(defaultChatRootValue);

const ChatRootScreen = () => {
  const ctx = useContext(ChatRootContext);

  if (!ctx.hasModels) {
    return <NoModelDownloadedScreen />;
  }
  if (ctx.modelIdInUse === undefined) {
    return <NoModelSelectedScreen />;
  }

  switch (ctx.status) {
    case SessionStatus.Ready:
      return (
        <ChatScreen
          conversationId={ctx.conversationId}
          messages={ctx.chatHistory}
          onConversationCreated={ctx.onConversationCreated}
        />
      );
    case SessionStatus.Error:
      return <ErrorScreen onRetry={ctx.onRetry} />;
    case SessionStatus.Loading:
    default:
      return <LoadingScreen />;
  }
};

export const ChatStackNavigator = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { models } = useModels();
  const { modelIdInUse } = useAppState();
  const { chat, createChat, disposeChat } = useAiService();

  const [status, setStatus] = useState<SessionStatus>(SessionStatus.Loading);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [loadedConversationId, setLoadedConversationId] =
    useState<LoadedConversationId>(undefined);
  const selfCreatedConversationIdRef = useRef<LoadedConversationId>(undefined);

  // --- Lifecycle steps -------------------------------------------------------

  const mountModelAndCreateChat = useCallback(async () => {
    const { modelIdInUse: modelId } = getAppState();
    if (modelId === undefined) {
      throw new Error('ChatStackNavigator: no model in use');
    }

    const model = await getModelById(modelId);
    if (model === undefined) {
      throw new Error(`ChatStackNavigator: model ${modelId} not found`);
    }

    await createChat({ model });
    if (chat.current === undefined) {
      throw new Error('ChatStackNavigator: chat creation failed');
    }
  }, [createChat, chat]);

  const resetAndLoadChatHistory = useCallback(async () => {
    if (chat.current === undefined) {
      throw new Error('ChatStackNavigator: current chat is undefined');
    }

    const { modelIdInUse: modelId, conversationIdInUse } = getAppState();
    if (conversationIdInUse === undefined) {
      await chat.current.setChatHistory([]);
      setChatHistory([]);
      setLoadedConversationId(undefined);
      return;
    }

    const conversation = await getConversationById(conversationIdInUse);
    if (conversation === undefined) {
      throw new Error(
        `ChatStackNavigator: conversation ${conversationIdInUse} not found`,
      );
    }

    if (conversation.modelId !== modelId) {
      throw new Error(
        `ChatStackNavigator: conversation ${conversationIdInUse} belongs to model ${conversation.modelId}, not ${modelId}`,
      );
    }

    const messages = await getMessagesByConversationId(conversationIdInUse);
    const history = toChatHistory(messages);

    await chat.current.setChatHistory(history);

    setChatHistory(history);
    setLoadedConversationId(conversationIdInUse);
  }, [chat]);

  // --- Lifecycle orchestrators ----------------------------------------------

  // Sessions have no cancellation, so when a new one starts while another is
  // still in flight (e.g. rapid model switches), only the latest may report
  // its outcome — a stale session finishing late must not flip the status.
  const sessionIdRef = useRef(0);

  const runSession = useCallback(async (steps: () => Promise<void>) => {
    const sessionId = ++sessionIdRef.current;
    const isCurrent = () => sessionId === sessionIdRef.current;

    setStatus(SessionStatus.Loading);
    try {
      await steps();
      if (isCurrent()) {
        setStatus(SessionStatus.Ready);
      }
    } catch (error) {
      if (isCurrent()) {
        devLog('ChatStackNavigator session error', error);
        setStatus(SessionStatus.Error);
      }
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

  // Called by ChatScreen when it creates a conversation for its first message.
  // The screen already displays that conversation, so we record it as loaded
  // (making the subscription below skip a reload) and persist it for the drawer
  // and next launch — without touching chatHistory, so the screen never remounts.
  const handleConversationCreated = useCallback((id: number) => {
    selfCreatedConversationIdRef.current = id;
    setAppState({ conversationIdInUse: id });
  }, []);

  // --- Lifecycle triggers ----------------------------------------------------

  // Initial load. With no model in use there is no session to start —
  // NoModelSelectedScreen is shown instead.
  useEffect(() => {
    if (getAppState().modelIdInUse !== undefined) {
      startSession();
    }
  }, [startSession]);

  // React to app-state changes: a model change tears down the chat and
  // rebuilds from scratch; a conversation-only change reloads just the history.
  useEffect(() => {
    return subscribeAppState((next, prev) => {
      if (next.modelIdInUse !== prev.modelIdInUse) {
        disposeChat();
        if (next.modelIdInUse !== undefined) {
          startSession();
        }
      } else if (next.conversationIdInUse !== prev.conversationIdInUse) {
        if (
          selfCreatedConversationIdRef.current !== undefined &&
          next.conversationIdInUse === selfCreatedConversationIdRef.current
        ) {
          selfCreatedConversationIdRef.current = undefined;
          return;
        }
        refreshChatHistory();
      }
    });
  }, [disposeChat, startSession, refreshChatHistory]);

  const chatRootValue = useMemo<ChatRootContextValue>(
    () => ({
      hasModels: models.length > 0,
      modelIdInUse,
      status,
      chatHistory,
      conversationId: loadedConversationId,
      onConversationCreated: handleConversationCreated,
      onRetry: startSession,
    }),
    [
      models.length,
      modelIdInUse,
      status,
      chatHistory,
      loadedConversationId,
      handleConversationCreated,
      startSession,
    ],
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

  return (
    <ChatRootContext.Provider value={chatRootValue}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.onSurface,
          headerTitleStyle: { color: colors.onSurface },
        }}
      >
        <Stack.Screen
          name="ChatScreen"
          component={ChatRootScreen}
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
    </ChatRootContext.Provider>
  );
};
