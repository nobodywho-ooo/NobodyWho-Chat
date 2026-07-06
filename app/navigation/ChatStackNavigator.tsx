/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { AppState, AppStateStatus, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SamplerPresets } from 'react-native-nobodywho';
import { DisplayMessage, isChatPipeline, isTtsPipeline } from 'types';
import {
  DEFAULT_ASSISTANT_CONFIG,
  getAppState,
  setAppState,
  subscribeAppState,
} from 'database';
import {
  getConversationById,
  getMessagesByConversationId,
  getModelById,
} from 'repositories';
import {
  log,
  isIOS,
  isExternalPickerActive,
  toChatHistory,
  toModelHistory,
} from 'helpers';
import { PlatformIcon } from 'components';
import { useAppState, useModels, useStyled } from 'hooks';
import { useAiService } from 'services';
import {
  ChatScreen,
  CustomizeAssistantScreen,
  DownloadedModelsScreen,
  ErrorScreen,
  LoadingScreen,
  ModelsScreen,
  NoModelDownloadedScreen,
  NoModelSelectedScreen,
  PrivacyPolicyScreen,
  SettingsScreen,
  TermsScreen,
} from 'screens';

const Stack = createNativeStackNavigator();

enum SessionStatus {
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}

type LoadedConversationId = number | undefined;

interface ChatRootContextValue {
  modelsLoading: boolean;
  hasModels: boolean;
  modelIdInUse: number | undefined;
  status: SessionStatus;
  chatHistory: DisplayMessage[];
  conversationId: LoadedConversationId;
  loadingMessage: string;
  onConversationCreated: (id: number) => void;
  onRetry: () => void;
}

const defaultChatRootValue: ChatRootContextValue = {
  modelsLoading: true,
  hasModels: false,
  modelIdInUse: undefined,
  status: SessionStatus.Loading,
  chatHistory: [],
  conversationId: undefined,
  loadingMessage: '',
  onConversationCreated: () => undefined,
  onRetry: () => undefined,
};

const ChatRootContext =
  createContext<ChatRootContextValue>(defaultChatRootValue);

const ChatRootScreen = () => {
  const ctx = useContext(ChatRootContext);

  if (ctx.modelsLoading) {
    return <LoadingScreen message={ctx.loadingMessage} />;
  }

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
      return <LoadingScreen message={ctx.loadingMessage} />;
  }
};

export const ChatStackNavigator = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { models, loading: modelsLoading } = useModels();
  const { modelIdInUse } = useAppState();
  const { chat, createChat, disposeChat, createTts, disposeTts } =
    useAiService();

  const [status, setStatus] = useState<SessionStatus>(SessionStatus.Loading);
  const [chatHistory, setChatHistory] = useState<DisplayMessage[]>([]);
  const [loadedConversationId, setLoadedConversationId] =
    useState<LoadedConversationId>(undefined);
  const selfCreatedConversationIdRef = useRef<LoadedConversationId>(undefined);

  // --- Lifecycle steps -------------------------------------------------------

  const mountModelAndCreateChat = useCallback(async () => {
    const {
      modelIdInUse: modelId,
      assistantConfig = DEFAULT_ASSISTANT_CONFIG,
    } = getAppState();
    if (modelId === undefined) {
      throw new Error('ChatStackNavigator: no model in use');
    }

    const model = await getModelById(modelId);
    if (model === undefined) {
      throw new Error(`ChatStackNavigator: model ${modelId} not found`);
    }

    // Every write site keeps non-chat models out of modelIdInUse; this is the
    // tripwire in case one slips through — fail loudly, not deep in the
    // native loader.
    if (!isChatPipeline(model.pipeline)) {
      throw new Error(
        `ChatStackNavigator: model ${modelId} (${model.pipeline}) is not a chat model`,
      );
    }

    await createChat({
      model,
      systemPrompt: assistantConfig.systemPrompt.trim() || undefined,
      sampler: SamplerPresets.temperature(assistantConfig.temperature),
      contextSize: assistantConfig.contextSize,
      thinking: assistantConfig.thinking,
      toolCalling: assistantConfig.toolCalling,
    });
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

    await chat.current.setChatHistory(toModelHistory(messages));

    setChatHistory(toChatHistory(messages));
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
        log('ChatStackNavigator session error', error, { capture: true });
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
  const refreshChatHistory = useCallback(async () => {
    try {
      await resetAndLoadChatHistory();
      setStatus(SessionStatus.Ready);
    } catch (error) {
      // A model switch can dispose our chat mid-load; since that takes seconds,
      // let its startSession own the status rather than flashing an error screen.
      if (chat.current === undefined) return;
      log('ChatStackNavigator history refresh error', error, { capture: true });
      setStatus(SessionStatus.Error);
    }
  }, [chat, resetAndLoadChatHistory]);

  // Called by ChatScreen when it creates a conversation for its first message.
  // The screen already displays that conversation, so we record it as loaded
  // (making the subscription below skip a reload) and persist it for the drawer
  // and next launch — without touching chatHistory, so the screen never remounts.
  const handleConversationCreated = useCallback((id: number) => {
    selfCreatedConversationIdRef.current = id;
    setAppState({ conversationIdInUse: id });
  }, []);

  const loadTtsIfSelected = useCallback(async () => {
    // TODO: uncomment when TTS is ready
    return;

    // const { ttsModelIdInUse } = getAppState();
    // if (ttsModelIdInUse === undefined) {
    //   return;
    // }
    // const model = await getModelById(ttsModelIdInUse);
    // if (model === undefined || !isTtsPipeline(model.pipeline)) {
    //   return;
    // }
    // await createTts({ model }).catch(error =>
    //   log('ChatStackNavigator tts load', error, { capture: true }),
    // );
    // }, [createTts]);
  }, []);

  // --- Lifecycle triggers ----------------------------------------------------

  // Initial load. With no model in use there is no session to start —
  // NoModelSelectedScreen is shown instead.
  useEffect(() => {
    if (getAppState().modelIdInUse !== undefined) {
      startSession();
    }
    loadTtsIfSelected();
  }, [startSession, loadTtsIfSelected]);

  // React to app-state changes: a model or assistant-config change tears down
  // the chat and rebuilds from scratch; a conversation-only change reloads just the history.
  useEffect(() => {
    return subscribeAppState((next, prev) => {
      if (next.ttsModelIdInUse !== prev.ttsModelIdInUse) {
        disposeTts();
        if (next.ttsModelIdInUse !== undefined) {
          loadTtsIfSelected();
        }
      }

      if (
        next.modelIdInUse !== prev.modelIdInUse ||
        next.assistantConfig !== prev.assistantConfig
      ) {
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
  }, [
    disposeChat,
    disposeTts,
    startSession,
    refreshChatHistory,
    loadTtsIfSelected,
  ]);

  const unloadedForBackground = useRef(false);
  const ttsUnloadedForBackground = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background') {
          if (isExternalPickerActive()) {
            return;
          }
          if (getAppState().modelIdInUse !== undefined) {
            disposeChat();
            unloadedForBackground.current = true;
          }
          if (getAppState().ttsModelIdInUse !== undefined) {
            disposeTts();
            ttsUnloadedForBackground.current = true;
          }
        } else if (nextState === 'active') {
          if (unloadedForBackground.current) {
            unloadedForBackground.current = false;
            if (getAppState().modelIdInUse !== undefined) {
              startSession();
            }
          }
          if (ttsUnloadedForBackground.current) {
            ttsUnloadedForBackground.current = false;
            loadTtsIfSelected();
          }
        }
      },
    );
    return () => subscription.remove();
  }, [disposeChat, disposeTts, startSession, loadTtsIfSelected]);

  const inUseModelName = models.find(m => m.id === modelIdInUse)?.name;
  const loadingMessage = inUseModelName
    ? t('screens.loadingScreen.loadingModel', { model: inUseModelName })
    : t('common.loading');

  // Only chat-capable models make the chat root usable — a device with only a
  // voice model downloaded still has nothing to chat with.
  const hasChatModels = useMemo(
    () => models.some(model => isChatPipeline(model.pipeline)),
    [models],
  );

  const chatRootValue = useMemo<ChatRootContextValue>(
    () => ({
      modelsLoading,
      hasModels: hasChatModels,
      modelIdInUse,
      status,
      chatHistory,
      conversationId: loadedConversationId,
      loadingMessage,
      onConversationCreated: handleConversationCreated,
      onRetry: startSession,
    }),
    [
      modelsLoading,
      hasChatModels,
      modelIdInUse,
      status,
      chatHistory,
      loadedConversationId,
      loadingMessage,
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
          // inactiveBehavior prevents expo-audio from crashing
          options={{ headerShown: false, inactiveBehavior: 'none' }}
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
          name="CustomizeAssistantScreen"
          component={CustomizeAssistantScreen}
          options={({ navigation }) => ({
            title: t('navigation.customizeAssistant'),
            presentation: 'modal',
            headerRight: () => renderCloseButton(navigation),
          })}
        />
        <Stack.Screen
          name="DownloadedModelsScreen"
          component={DownloadedModelsScreen}
          options={{
            title: '',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="TermsScreen"
          component={TermsScreen}
          options={({ navigation }) => ({
            title: t('navigation.terms'),
            presentation: 'modal',
            headerRight: () => renderCloseButton(navigation),
          })}
        />
        <Stack.Screen
          name="PrivacyPolicyScreen"
          component={PrivacyPolicyScreen}
          options={({ navigation }) => ({
            title: t('navigation.privacyPolicy'),
            presentation: 'modal',
            headerRight: () => renderCloseButton(navigation),
          })}
        />
      </Stack.Navigator>
    </ChatRootContext.Provider>
  );
};
