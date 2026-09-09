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
import {
  AppState,
  AppStateStatus,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SamplerPresets } from 'react-native-nobodywho';
import {
  DisplayMessage,
  Model,
  ModelSlot,
  isChatPipeline,
  modelSlotSpec,
} from 'types';
import {
  AssistantConfig,
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
  isForegroundHeld,
  toChatHistory,
  toModelHistory,
} from 'helpers';
import { PlatformIcon, Toast } from 'components';
import { useAppState, useModels, useStyled } from 'hooks';
import { subscribeConversationSync, useAiService } from 'services';
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

const EMPTY_HISTORY: DisplayMessage[] = [];

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
    return <LoadingScreen />;
  }

  if (!ctx.hasModels) {
    return <NoModelDownloadedScreen />;
  }
  if (ctx.modelIdInUse === undefined) {
    return <NoModelSelectedScreen />;
  }

  if (ctx.status === SessionStatus.Error) {
    return <ErrorScreen onRetry={ctx.onRetry} />;
  }

  const loading = ctx.status === SessionStatus.Loading;

  return (
    <View style={styles.chatRoot}>
      <ChatScreen
        conversationId={ctx.conversationId}
        messages={ctx.chatHistory}
        onConversationCreated={ctx.onConversationCreated}
        disabled={loading}
      />
      <Toast visible={loading} message={ctx.loadingMessage} loading />
    </View>
  );
};

export const ChatStackNavigator = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { models, loading: modelsLoading } = useModels();
  const { modelIdInUse } = useAppState();
  const {
    chat,
    createChat,
    disposeChat,
    createTts,
    disposeTts,
    createStt,
    disposeStt,
    createVad,
    disposeVad,
  } = useAiService();

  const [status, setStatus] = useState<SessionStatus>(SessionStatus.Loading);
  const [chatHistory, setChatHistory] =
    useState<DisplayMessage[]>(EMPTY_HISTORY);
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
      setChatHistory(EMPTY_HISTORY);
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

  // Reload only the displayed history for a conversation, without touching the
  // native chat. Used for a voice turn: VoiceAssistantScreen drives our shared
  // chat, so its context is already current — only the on-screen messages need
  // to catch up.
  const reloadDisplayHistory = useCallback(async (id: number) => {
    try {
      const messages = await getMessagesByConversationId(id);
      setChatHistory(toChatHistory(messages));
      setLoadedConversationId(id);
    } catch (error) {
      log('ChatStackNavigator voice history reload', error, { capture: true });
    }
  }, []);

  // A voice turn persisted messages to `id`. If it started a brand-new
  // conversation, adopt it as in-use (for the drawer and next launch), marking
  // it self-created so the app-state subscription below skips its native reset —
  // the shared chat already holds the turn. Either way, refresh the display.
  const handleConversationSynced = useCallback(
    (id: number) => {
      if (getAppState().conversationIdInUse !== id) {
        selfCreatedConversationIdRef.current = id;
        setAppState({ conversationIdInUse: id });
      }
      reloadDisplayHistory(id);
    },
    [reloadDisplayHistory],
  );

  useEffect(
    () => subscribeConversationSync(handleConversationSynced),
    [handleConversationSynced],
  );

  // The engines that load straight from their own app-state slot, as opposed to
  // the chat model, whose load goes through startSession (history, system
  // prompt, sampler). Driving them from one table keeps the three lifecycle
  // sites — first load, app-state change, and background/foreground — from
  // drifting apart, which is how a slot ends up loading on launch but never
  // coming back after a resume.
  const auxSlots = useMemo(
    () => [
      {
        slot: ModelSlot.tts,
        dispose: disposeTts,
        create: (model: Model) => {
          // Voice/language were resolved and stored when this model was
          // selected (see resolveTtsPrefs at the selection sites), each in the
          // vocabulary its engine accepts. Read them straight from the config —
          // undefined lets the engine keep its own default for that option.
          const { assistantConfig = DEFAULT_ASSISTANT_CONFIG } = getAppState();
          return createTts({
            model,
            voice: assistantConfig.ttsVoice,
            language: assistantConfig.ttsLanguage,
          });
        },
        // Voice and language live in assistantConfig but are load-time options,
        // so an edit to either has to reload the engine even though the
        // selected model is unchanged.
        configChanged: (next: AssistantConfig, prev: AssistantConfig) =>
          next.ttsVoice !== prev.ttsVoice ||
          next.ttsLanguage !== prev.ttsLanguage,
      },
      {
        slot: ModelSlot.stt,
        dispose: disposeStt,
        create: (model: Model) => {
          // Undefined is the automatic setting: the engine then detects the
          // spoken language on every transcription, which a fixed code skips.
          const { assistantConfig = DEFAULT_ASSISTANT_CONFIG } = getAppState();
          return createStt({ model, language: assistantConfig.sttLanguage });
        },
        // Like the TTS options above, the language is fixed at load time, so
        // changing it has to reload the engine on an unchanged model.
        configChanged: (next: AssistantConfig, prev: AssistantConfig) =>
          next.sttLanguage !== prev.sttLanguage,
      },
      {
        slot: ModelSlot.vad,
        dispose: disposeVad,
        create: (model: Model) => createVad({ model }),
      },
    ],
    [createTts, createStt, createVad, disposeTts, disposeStt, disposeVad],
  );

  type AuxSlot = (typeof auxSlots)[number];

  // Called fire-and-forget from all three lifecycle sites, so every await inside
  // has to be guarded: the model lookup opens the database lazily and can reject
  // when the handle is closed or the tables are being rebuilt, which is exactly
  // what a foreground transition racing a reset looks like.
  const loadAuxSlot = useCallback(async (entry: AuxSlot) => {
    const { appStateKey, accepts } = modelSlotSpec(entry.slot);

    try {
      const modelId = getAppState()[appStateKey];

      if (modelId === undefined) {
        return;
      }

      const model = await getModelById(modelId);

      if (model === undefined || !accepts(model.pipeline)) {
        return;
      }

      await entry.create(model);
    } catch (error) {
      log(`ChatStackNavigator ${entry.slot} load`, error, { capture: true });
    }
  }, []);

  // --- Lifecycle triggers ----------------------------------------------------

  // Initial load. With no model in use there is no session to start —
  // NoModelSelectedScreen is shown instead.
  useEffect(() => {
    if (getAppState().modelIdInUse !== undefined) {
      startSession();
    }
    auxSlots.forEach(loadAuxSlot);
  }, [startSession, auxSlots, loadAuxSlot]);

  // React to app-state changes: a model or assistant-config change tears down
  // the chat and rebuilds from scratch; a conversation-only change reloads just the history.
  useEffect(() => {
    return subscribeAppState((next, prev) => {
      // Compare effective configs, the way mountModelAndCreateChat resolves
      // them. assistantConfig stays undefined until something writes it, so
      // comparing raw values would read the first write — selecting a voice
      // model stamps the defaults in — as a change to every field.
      const nextConfig = next.assistantConfig ?? DEFAULT_ASSISTANT_CONFIG;
      const prevConfig = prev.assistantConfig ?? DEFAULT_ASSISTANT_CONFIG;

      auxSlots.forEach(entry => {
        const { appStateKey } = modelSlotSpec(entry.slot);
        const selected = next[appStateKey];
        const modelChanged = selected !== prev[appStateKey];
        const optionsChanged =
          selected !== undefined &&
          (entry.configChanged?.(nextConfig, prevConfig) ?? false);

        if (!modelChanged && !optionsChanged) {
          return;
        }

        entry.dispose();

        if (selected !== undefined) {
          loadAuxSlot(entry);
        }
      });

      // Only model changes or chat-affecting config rebuild the chat — a
      // voice/language edit must not tear down the loaded chat model.
      const chatConfigChanged =
        nextConfig.temperature !== prevConfig.temperature ||
        nextConfig.systemPrompt !== prevConfig.systemPrompt ||
        nextConfig.thinking !== prevConfig.thinking ||
        nextConfig.toolCalling !== prevConfig.toolCalling ||
        nextConfig.contextSize !== prevConfig.contextSize;

      if (next.modelIdInUse !== prev.modelIdInUse || chatConfigChanged) {
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
  }, [disposeChat, startSession, refreshChatHistory, auxSlots, loadAuxSlot]);

  // Which slots this component released on the way to the background, so the
  // resume reloads exactly those. A set keyed by slot rather than one boolean
  // ref per engine: a new slot then needs no matching ref, and a forgotten one
  // can't leave an engine unloaded after a resume with nothing to notice it.
  const unloadedForBackground = useRef(new Set<ModelSlot>());

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background') {
          if (isForegroundHeld()) {
            return;
          }

          if (getAppState().modelIdInUse !== undefined) {
            disposeChat();
            unloadedForBackground.current.add(ModelSlot.chat);
          }

          auxSlots.forEach(entry => {
            const { appStateKey } = modelSlotSpec(entry.slot);

            if (getAppState()[appStateKey] !== undefined) {
              entry.dispose();
              unloadedForBackground.current.add(entry.slot);
            }
          });
        } else if (nextState === 'active') {
          const unloaded = unloadedForBackground.current;

          if (unloaded.delete(ModelSlot.chat)) {
            if (getAppState().modelIdInUse !== undefined) {
              startSession();
            }
          }

          auxSlots.forEach(entry => {
            if (unloaded.delete(entry.slot)) {
              loadAuxSlot(entry);
            }
          });
        }
      },
    );
    return () => subscription.remove();
  }, [disposeChat, startSession, auxSlots, loadAuxSlot]);

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

const styles = StyleSheet.create({
  chatRoot: {
    flex: 1,
  },
});
