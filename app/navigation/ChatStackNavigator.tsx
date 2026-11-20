import React, {
  ComponentRef,
  RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BlurTargetView } from 'expo-blur';
import { useHeaderHeight } from '@react-navigation/elements';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SamplerPresets } from 'react-native-nobodywho';
import {
  DisplayMessage,
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
import { log, isForegroundHeld, toChatHistory, toModelHistory } from 'helpers';
import { Toast } from 'components';
import { Spacings } from 'style';
import { useAppState, useModels } from 'hooks';
import {
  A2UI_SYSTEM_PROMPT_HINT,
  VOICE_SLOTS,
  VoiceSlot,
  settleConversationDigest,
  subscribeConversationSync,
  useAiService,
} from 'services';
import {
  ChatScreen,
  ErrorScreen,
  LoadingScreen,
  NoModelDownloadedScreen,
  NoModelSelectedScreen,
} from 'screens';

enum SessionStatus {
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}

type LoadedConversationId = number | undefined;

const emptyHistory = (): DisplayMessage[] => [];

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

type ViewRef = ComponentRef<typeof View>;

const BelowHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const headerHeight = useHeaderHeight();

  return (
    <View style={[styles.chatRoot, { paddingTop: headerHeight }]}>
      {children}
    </View>
  );
};

const ChatRootScreen = () => {
  const ctx = useContext(ChatRootContext);
  const headerHeight = useHeaderHeight();
  const [blurTargetNode, setBlurTargetNode] = useState<ViewRef | null>(null);
  const blurTarget = useMemo(
    () => ({ current: blurTargetNode }),
    [blurTargetNode],
  );

  if (ctx.modelsLoading) {
    return (
      <BelowHeader>
        <LoadingScreen />
      </BelowHeader>
    );
  }

  if (!ctx.hasModels) {
    return (
      <BelowHeader>
        <NoModelDownloadedScreen />
      </BelowHeader>
    );
  }
  if (ctx.modelIdInUse === undefined) {
    return (
      <BelowHeader>
        <NoModelSelectedScreen />
      </BelowHeader>
    );
  }

  if (ctx.status === SessionStatus.Error) {
    return (
      <BelowHeader>
        <ErrorScreen onRetry={ctx.onRetry} />
      </BelowHeader>
    );
  }

  const loading = ctx.status === SessionStatus.Loading;

  return (
    <View style={styles.chatRoot}>
      <BlurTargetView
        ref={setBlurTargetNode as unknown as RefObject<ViewRef | null>}
        style={styles.chatRoot}
      >
        <ChatScreen
          conversationId={ctx.conversationId}
          messages={ctx.chatHistory}
          onConversationCreated={ctx.onConversationCreated}
          disabled={loading}
        />
      </BlurTargetView>
      <Toast
        visible={loading}
        message={ctx.loadingMessage}
        loading
        blurTarget={blurTarget}
        style={{ top: headerHeight + Spacings.md }}
      />
    </View>
  );
};

export const ChatStackNavigator = () => {
  const { t } = useTranslation();
  const { models, loading: modelsLoading } = useModels();
  const { modelIdInUse } = useAppState();
  const { slots, ensureVoiceEngine } = useAiService();
  const chat = slots.chat.ref;

  const [status, setStatus] = useState<SessionStatus>(SessionStatus.Loading);
  const [chatHistory, setChatHistory] =
    useState<DisplayMessage[]>(emptyHistory);
  const [loadedConversationId, setLoadedConversationId] =
    useState<LoadedConversationId>(undefined);
  const selfCreatedConversationIdRef = useRef<LoadedConversationId>(undefined);

  // --- Lifecycle steps -------------------------------------------------------

  // Resolves to whether the chat is loaded and ours to use. False means a dispose superseded the load
  const mountModelAndCreateChat = useCallback(async (): Promise<boolean> => {
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

    // When A2UI is on, the chat also carries a short directive telling the
    // model to use render_ui for UI asks — tool descriptions alone don't make
    // small local models reach for a tool mid-answer.
    const systemPrompt = assistantConfig.a2ui
      ? [assistantConfig.systemPrompt.trim(), A2UI_SYSTEM_PROMPT_HINT]
          .filter(Boolean)
          .join('\n\n')
      : assistantConfig.systemPrompt.trim();

    const created = await slots.chat.create({
      model,
      systemPrompt: systemPrompt || undefined,
      sampler: SamplerPresets.temperature(assistantConfig.temperature),
      contextSize: assistantConfig.contextSize,
      thinking: assistantConfig.thinking,
      toolCalling: assistantConfig.toolCalling,
      a2ui: assistantConfig.a2ui,
    });

    return created && chat.current !== undefined;
  }, [slots, chat]);

  // Bumped by every history load. Loads can overlap: two quick drawer picks for e.g
  const historyLoadRef = useRef(0);

  const resetAndLoadChatHistory = useCallback(async () => {
    const load = ++historyLoadRef.current;
    const isCurrent = () => load === historyLoadRef.current;

    if (chat.current === undefined) {
      throw new Error('ChatStackNavigator: current chat is undefined');
    }

    // A background digest run restores the previous conversation's history
    // when it ends: let it finish first so it can't overwrite this load.
    await settleConversationDigest();

    if (!isCurrent()) {
      return;
    }

    const { modelIdInUse: modelId, conversationIdInUse } = getAppState();
    if (conversationIdInUse === undefined) {
      await chat.current.setChatHistory([]);
      if (!isCurrent()) {
        return;
      }
      setChatHistory(emptyHistory());
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

    if (!isCurrent()) {
      return;
    }

    if (chat.current === undefined) {
      throw new Error('ChatStackNavigator: current chat is undefined');
    }

    await chat.current.setChatHistory(toModelHistory(messages));

    if (!isCurrent()) {
      return;
    }

    setChatHistory(toChatHistory(messages));
    setLoadedConversationId(conversationIdInUse);
  }, [chat]);

  // --- Lifecycle orchestrators ----------------------------------------------

  // Sessions have no cancellation, so when a new one starts while another is
  // still in flight (e.g. rapid model switches), only the latest may report
  // its outcome — a stale session finishing late must not flip the status.
  const sessionIdRef = useRef(0);

  const runSession = useCallback(async (steps: () => Promise<boolean>) => {
    const sessionId = ++sessionIdRef.current;
    const isCurrent = () => sessionId === sessionIdRef.current;

    setStatus(SessionStatus.Loading);

    try {
      const completed = await steps();
      if (completed && isCurrent()) {
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
        const mounted = await mountModelAndCreateChat();

        if (!mounted) {
          return false;
        }

        try {
          await resetAndLoadChatHistory();
        } catch (error) {
          if (chat.current === undefined) {
            return false;
          }
          throw error;
        }

        return true;
      }),
    [runSession, mountModelAndCreateChat, resetAndLoadChatHistory, chat],
  );

  // History-only refresh: used when the in-use chat changes (same model/chat).
  const refreshChatHistory = useCallback(async () => {
    const sessionId = sessionIdRef.current;

    try {
      await resetAndLoadChatHistory();

      if (sessionId === sessionIdRef.current) {
        setStatus(SessionStatus.Ready);
      }
    } catch (error) {
      // A model switch can dispose our chat mid-load; since that takes seconds,
      // let its startSession own the status rather than flashing an error screen.
      if (chat.current === undefined || sessionId !== sessionIdRef.current) {
        return;
      }
      log('ChatStackNavigator history refresh error', error, { capture: true });
      setStatus(SessionStatus.Error);
    }
  }, [chat, resetAndLoadChatHistory]);

  // Called by ChatScreen when it creates a conversation for its first message.
  // The screen already displays that conversation, so we record it as loaded
  // (making the subscription below skip a reload) and persist it for the drawer
  // and next launch — without touching chatHistory, so the screen never remounts.
  //
  // Recording it as loaded is what lets a later New Chat or delete land: those
  // only clear conversationIdInUse, and the reload that follows hands the screen
  // an empty history for no conversation. Left pointing at none, this state
  // would make that reload indistinguishable from where we already were, and the
  // screen would keep showing the conversation it created.
  const handleConversationCreated = useCallback((id: number) => {
    selfCreatedConversationIdRef.current = id;
    setLoadedConversationId(id);
    setAppState({ conversationIdInUse: id });
  }, []);

  // Reload only the displayed history for a conversation, without touching the
  // native chat. Used for a voice turn: VoiceAssistantScreen drives our shared
  // chat, so its context is already current — only the on-screen messages need
  // to catch up.
  const reloadDisplayHistory = useCallback(async (id: number) => {
    const load = ++historyLoadRef.current;

    try {
      const messages = await getMessagesByConversationId(id);
      if (load !== historyLoadRef.current) {
        return;
      }
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

  // Voice and language live in assistantConfig but are load-time options, so
  // an edit to one has to reload its engine even though the selected model is
  // unchanged. VAD has no options.
  const voiceConfigChanged = useCallback(
    (slot: VoiceSlot, next: AssistantConfig, prev: AssistantConfig) => {
      switch (slot) {
        case ModelSlot.tts:
          return (
            next.ttsVoice !== prev.ttsVoice ||
            next.ttsLanguage !== prev.ttsLanguage
          );
        case ModelSlot.stt:
          return next.sttLanguage !== prev.sttLanguage;
        case ModelSlot.vad:
          return false;
      }
    },
    [],
  );

  // --- Lifecycle triggers ----------------------------------------------------

  // Initial load. With no model in use there is no session to start —
  // NoModelSelectedScreen is shown instead.
  useEffect(() => {
    if (getAppState().modelIdInUse !== undefined) {
      startSession();
    }
  }, [startSession]);

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

      VOICE_SLOTS.forEach(slot => {
        const { appStateKey } = modelSlotSpec(slot);
        const selected = next[appStateKey];
        const modelChanged = selected !== prev[appStateKey];
        const optionsChanged =
          selected !== undefined &&
          voiceConfigChanged(slot, nextConfig, prevConfig);

        if (!modelChanged && !optionsChanged) {
          return;
        }

        const wasLoaded = slots[slot].ref.current !== undefined;

        slots[slot].dispose();

        if (selected !== undefined && wasLoaded) {
          ensureVoiceEngine(slot);
        }
      });

      // Only model changes or chat-affecting config rebuild the chat — a
      // voice/language edit must not tear down the loaded chat model. Thinking
      // isn't one: each turn sets `enable_thinking` on the loaded chat.
      const chatConfigChanged =
        nextConfig.temperature !== prevConfig.temperature ||
        nextConfig.systemPrompt !== prevConfig.systemPrompt ||
        nextConfig.toolCalling !== prevConfig.toolCalling ||
        nextConfig.a2ui !== prevConfig.a2ui ||
        nextConfig.contextSize !== prevConfig.contextSize;

      if (next.modelIdInUse !== prev.modelIdInUse || chatConfigChanged) {
        slots.chat.dispose();
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
        // Switch to another conversation (New chat, delete...)
        try {
          chat.current?.stopGeneration();
        } catch (error) {
          log('ChatStackNavigator stopGeneration', error);
        }
        refreshChatHistory();
      }
    });
  }, [
    slots,
    chat,
    startSession,
    refreshChatHistory,
    voiceConfigChanged,
    ensureVoiceEngine,
  ]);

  // Whether the chat was released on the way to the background, so the resume
  // reloads it. The speech engines are released too but not reloaded: they
  // come back on their next use, so a resume only waits for the chat model.
  const chatUnloadedForBackground = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background') {
          if (isForegroundHeld()) {
            return;
          }

          if (getAppState().modelIdInUse !== undefined) {
            slots.chat.dispose();
            chatUnloadedForBackground.current = true;
          }

          VOICE_SLOTS.forEach(slot => slots[slot].dispose());
        } else if (nextState === 'active') {
          if (chatUnloadedForBackground.current) {
            chatUnloadedForBackground.current = false;

            if (getAppState().modelIdInUse !== undefined) {
              startSession();
            }
          }
        }
      },
    );
    return () => subscription.remove();
  }, [slots, startSession]);

  const inUseModelName = models.find(m => m.id === modelIdInUse)?.name;
  const loadingMessage = inUseModelName
    ? t('screens.loadingScreen.loadingModel', { model: inUseModelName })
    : t('common.loading');

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

  return (
    <ChatRootContext.Provider value={chatRootValue}>
      <ChatRootScreen />
    </ChatRootContext.Provider>
  );
};

const styles = StyleSheet.create({
  chatRoot: {
    flex: 1,
  },
});
