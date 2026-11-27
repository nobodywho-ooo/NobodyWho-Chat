import React, {
  ComponentRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Keyboard, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareLegendList } from '@legendapp/list/keyboard';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { BlurTargetView, BlurView } from 'expo-blur';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useIsFocused } from 'expo-router';
import LinearGradient from 'react-native-linear-gradient';
import {
  AmbientGlow,
  GlassScrollEdge,
  MessageListItem,
  ScrollToBottomButton,
  Toast,
} from 'components';
import { useTheme } from 'context';
import {
  useAppState,
  useKeepAwakeWhile,
  useStableCallback,
  useStyled,
} from 'hooks';
import {
  DisplayMessage,
  pipelineIngestsAudio,
  pipelineIngestsImage,
} from 'types';
import { useAiService, useWebSearchStore } from 'services';
import { isAndroid } from 'helpers';
import { Spacings } from 'style';
import { Theme } from 'types';

import {
  CameraCaptureModal,
  EmbeddingDownloadSheet,
  ContentColumn,
  InputBar,
  MessageStarters,
} from './components';
import {
  useAttachments,
  useChatColumn,
  useChatGeneration,
  useMessageListScroll,
  useSttTranscription,
  useThinkingToggle,
  useTtsPlayback,
  useWebSearchToggle,
} from './hooks';
import styles from './ChatScreen.styles';

const INPUT_BAR_PADDING = 14;

const WEB_NOTICE_VISIBLE_MS = 3500;
const TOGGLE_NOTICE_VISIBLE_MS = 2000;

const BLUR_INTENSITY = isAndroid ? 40 : 16;
const BLUR_REDUCTION_FACTOR = 5;

const gradientColors: Record<Theme, string[]> = {
  light: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)'],
  dark: ['rgba(18, 18, 18, 0)', 'rgba(18, 18, 18, 0.9)'],
};

const EmptyArea: React.FC = () => (
  <Pressable style={styles.emptyArea} onPress={Keyboard.dismiss} />
);

interface ChatScreenProps {
  conversationId: number | undefined;
  messages: DisplayMessage[];
  historyPending?: boolean;
  onConversationCreated: (conversationId: number) => void;
  disabled?: boolean;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  conversationId: initialConversationId,
  messages: initialMessages,
  historyPending = false,
  onConversationCreated,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerInset = useHeaderHeight();
  const { slots, chatPipeline } = useAiService();
  const column = useChatColumn();
  const { ttsModelIdInUse, sttModelIdInUse } = useAppState();

  const canPlayAudio = ttsModelIdInUse !== undefined;
  const canDictate = sttModelIdInUse !== undefined;
  const {
    playingId: audioPlayingId,
    loadingId: audioLoadingId,
    play: playAudio,
    stop: stopAudio,
  } = useTtsPlayback();
  const [inputText, setInputText] = useState('');

  const handleTranscribed = useCallback(
    (text: string) =>
      setInputText(prev => (prev.trim() ? `${prev.trimEnd()} ${text}` : text)),
    [],
  );
  const handleMicrophoneDenied = useCallback(
    () =>
      Alert.alert(
        t('components.inputBar.microphoneDeniedTitle'),
        t('components.inputBar.microphoneDeniedMessage'),
      ),
    [t],
  );

  const {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useSttTranscription({
    onTranscribed: handleTranscribed,
    onPermissionDenied: handleMicrophoneDenied,
  });
  const [messages, setMessages] = useState<DisplayMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [attachExpanded, setAttachExpanded] = useState(false);

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const blurTargetRef = useRef<ComponentRef<typeof View>>(null);
  const previousConversationIdRef = useRef<number | undefined | 'mount'>(
    'mount',
  );

  const list = useMessageListScroll(messages, headerInset, insets.bottom);
  const { showConversation } = list;

  const {
    webSearch,
    unavailableReason: webSearchUnavailableReason,
    toggle: toggleWebSearch,
    embeddingPrompt,
    chatModel: webChatModel,
    ramGB,
  } = useWebSearchToggle(conversationId);

  const { thinking, canThink, toggle: toggleThinking } = useThinkingToggle();

  const [toggleNotice, setToggleNotice] = useState<{
    id: number;
    message: string;
  } | null>(null);

  const webNotice = useWebSearchStore(state => state.notice);
  const clearWebNotice = useWebSearchStore(state => state.clearNotice);

  useEffect(() => {
    if (!webNotice) {
      return;
    }

    setToggleNotice(null);

    const timeout = setTimeout(
      () => clearWebNotice(webNotice.id),
      WEB_NOTICE_VISIBLE_MS,
    );

    return () => clearTimeout(timeout);
  }, [webNotice, clearWebNotice]);

  const showToggleNotice = useCallback(
    (message: string) => {
      const current = useWebSearchStore.getState().notice;

      if (current) {
        clearWebNotice(current.id);
      }

      setToggleNotice(previous => ({
        id: (previous?.id ?? 0) + 1,
        message,
      }));
    },
    [clearWebNotice],
  );

  useEffect(() => {
    if (!toggleNotice) {
      return;
    }

    const timeout = setTimeout(
      () => setToggleNotice(null),
      TOGGLE_NOTICE_VISIBLE_MS,
    );

    return () => clearTimeout(timeout);
  }, [toggleNotice]);

  const handleToggleWebSearch = useCallback(() => {
    const enabled = toggleWebSearch();

    if (enabled !== undefined) {
      showToggleNotice(
        t(enabled ? 'screens.chat.webSearchOn' : 'screens.chat.webSearchOff'),
      );
    }
  }, [toggleWebSearch, showToggleNotice, t]);

  const handleToggleThinking = useCallback(() => {
    const enabled = toggleThinking();

    showToggleNotice(
      t(enabled ? 'screens.chat.thinkingOn' : 'screens.chat.thinkingOff'),
    );
  }, [toggleThinking, showToggleNotice, t]);

  const canAttachImage = pipelineIngestsImage(chatPipeline);
  const canAttachAudio = pipelineIngestsAudio(chatPipeline);

  const attachments = useAttachments({
    ingestsImage: canAttachImage,
    ingestsAudio: canAttachAudio,
  });
  const { clearAllAttachments } = attachments;

  const { isStreaming, handleSend, stopStreaming } = useChatGeneration({
    chat: slots.chat.ref,
    thinking,
    ingestsImage: canAttachImage,
    ingestsAudio: canAttachAudio,
    inputText,
    setInputText,
    setMessages,
    conversationId,
    setConversationId,
    onConversationCreated,
    attachments,
    messages,
    onTurnStart: list.anchorSentMessage,
    webSearch,
  });

  useKeepAwakeWhile(isStreaming, { requireFocus: false });

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // A history reload of the conversation already on screen (an assistant
  // setting changed, a voice turn landed) re-keys every row (new:N -> row:<id>),
  // usually while a pushed screen covers this one. The list then drops all its
  // measured sizes and keeps the stale parked-message anchor, so rows end up
  // stacked on top of each other. Reset its layout once we're visible again.
  const isFocused = useIsFocused();
  const [relayoutPending, setRelayoutPending] = useState(false);
  const shownInitialMessagesRef = useRef(initialMessages);

  useEffect(() => {
    if (shownInitialMessagesRef.current === initialMessages) {
      return;
    }
    shownInitialMessagesRef.current = initialMessages;
    if (initialMessages.length > 0) {
      setRelayoutPending(true);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (!relayoutPending || !isFocused) {
      return;
    }
    setRelayoutPending(false);
    showConversation();
  }, [relayoutPending, isFocused, showConversation]);

  useEffect(() => {
    const previous = previousConversationIdRef.current;
    previousConversationIdRef.current = initialConversationId;

    const isSameConversation =
      previous === initialConversationId ||
      (previous === undefined &&
        initialConversationId !== undefined &&
        initialConversationId === conversationIdRef.current);

    if (isSameConversation) {
      return;
    }

    setConversationId(initialConversationId);
    setAttachExpanded(false);
    clearAllAttachments();
    stopAudio();
    cancelRecording();
    showConversation();
  }, [
    initialConversationId,
    clearAllAttachments,
    stopAudio,
    cancelRecording,
    showConversation,
  ]);

  // Switching models => Drop the attachments whenever the pipeline's capabilities change,
  useEffect(() => {
    setAttachExpanded(false);
    clearAllAttachments();
  }, [canAttachImage, canAttachAudio, clearAllAttachments]);

  const messageKey = useCallback(
    (item: DisplayMessage, index: number) => item.uid ?? `at:${index}`,
    [],
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: DisplayMessage; index: number }) => {
      const messageId = messageKey(item, index);

      return (
        <ContentColumn column={column}>
          <MessageListItem
            message={item}
            isStreaming={isStreaming && index === messages.length - 1}
            messageId={messageId}
            canPlayAudio={canPlayAudio}
            isAudioLoading={audioLoadingId === messageId}
            isAudioPlaying={audioPlayingId === messageId}
            onPlayAudio={playAudio}
            onStopAudio={stopAudio}
          />
        </ContentColumn>
      );
    },
    [
      column,
      isStreaming,
      messages.length,
      canPlayAudio,
      audioLoadingId,
      audioPlayingId,
      messageKey,
      playAudio,
      stopAudio,
    ],
  );

  const listExtraData = useMemo(
    () => ({
      column,
      isStreaming,
      lastIndex: messages.length - 1,
      canPlayAudio,
      audioLoadingId,
      audioPlayingId,
    }),
    [
      column,
      isStreaming,
      messages.length,
      canPlayAudio,
      audioLoadingId,
      audioPlayingId,
    ],
  );

  const hasMessages = messages.length > 0;

  const isEmptyChat = !hasMessages && !historyPending;

  const showStarters = isEmptyChat && !attachExpanded;
  const messageStarters = useMemo(
    () =>
      showStarters && (
        <MessageStarters
          pipeline={chatPipeline}
          onSelect={setInputText}
          disabled={disabled}
          column={column}
        />
      ),
    [showStarters, chatPipeline, disabled, column],
  );

  const listContentStyle = useMemo(
    () => [styles.listContent, { paddingTop: headerInset }],
    [headerInset],
  );

  const inputBarStyle = useMemo(
    () => ({ paddingBottom: insets.bottom + INPUT_BAR_PADDING }),
    [insets.bottom],
  );

  const onSend = useStableCallback(handleSend);
  const onStop = useStableCallback(stopStreaming);
  const onAttachImage = useStableCallback(attachments.handleAttachImage);
  const onAttachCamera = useStableCallback(attachments.handleAttachCamera);
  const onAttachAudio = useStableCallback(attachments.handleAttachAudio);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Pressable
        style={styles.dismissOverlay}
        onPress={Keyboard.dismiss}
        accessible={false}
      />
      <BlurTargetView ref={blurTargetRef} style={styles.blurTargetContainer}>
        <View
          style={[
            styles.blurTargetContent,
            { backgroundColor: colors.surface },
          ]}
        >
          <AmbientGlow visible={isEmptyChat} />
          <KeyboardAwareLegendList
            ref={list.listRef}
            data={messages}
            style={styles.listContainer}
            contentContainerStyle={listContentStyle}
            keyExtractor={messageKey}
            showsVerticalScrollIndicator={false}
            renderItem={renderMessage}
            extraData={listExtraData}
            ListEmptyComponent={EmptyArea}
            recycleItems={false}
            anchoredEndSpace={list.anchoredEndSpace}
            maintainVisibleContentPosition={list.maintainVisibleContentPosition}
            onScrollBeginDrag={list.onScrollBeginDrag}
            onScroll={list.onScroll}
            contentInsetEndAdjustment={list.contentInsetEndAdjustment}
            keyboardLiftBehavior="whenAtEnd"
            keyboardOffset={insets.bottom}
            freeze={list.freeze}
            applyWorkaroundForContentInsetHitTestBug
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={isAndroid ? 'on-drag' : 'interactive'}
          />
        </View>
      </BlurTargetView>
      <GlassScrollEdge
        anchor={headerInset}
        blurTarget={blurTargetRef}
        visible={!isEmptyChat}
      />
      {attachExpanded && (
        <Pressable
          style={styles.blurOverlay}
          onPress={() => setAttachExpanded(false)}
          accessible={false}
        >
          <BlurView
            style={styles.blurFill}
            intensity={BLUR_INTENSITY}
            tint={theme}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurReductionFactor={BLUR_REDUCTION_FACTOR}
            blurTarget={blurTargetRef}
          />
          <LinearGradient
            pointerEvents="none"
            colors={gradientColors[theme]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={styles.headerGradient}
          />
        </Pressable>
      )}
      <KeyboardStickyView
        offset={{ opened: insets.bottom }}
        style={styles.inputBarContainer}
        pointerEvents="box-none"
      >
        <ContentColumn column={column}>
          <ScrollToBottomButton
            visible={hasMessages && list.canScrollToBottom}
            onPress={list.scrollToBottom}
            blurTarget={blurTargetRef}
            style={styles.scrollToBottomContainer}
          />
        </ContentColumn>
        <InputBar
          composerRef={list.composerRef}
          onComposerLayout={list.onComposerLayout}
          value={inputText}
          isStreaming={isStreaming}
          disabled={disabled}
          attachExpanded={attachExpanded}
          onAttachExpandedChange={setAttachExpanded}
          canAttachImage={canAttachImage}
          canAttachAudio={canAttachAudio}
          imageSource={attachments.attachedDocuments?.imageSource}
          hasAudio={!!attachments.attachedDocuments?.audioPath}
          onAttachImage={onAttachImage}
          onAttachCamera={onAttachCamera}
          onAttachAudio={onAttachAudio}
          canDictate={canDictate}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          onStartDictation={startRecording}
          onStopDictation={stopRecording}
          webSearchEnabled={webSearch.enabled}
          webSearchUnavailableMessage={
            webSearchUnavailableReason &&
            t(`screens.chat.webSearchNotice.${webSearchUnavailableReason}`)
          }
          onToggleWebSearch={handleToggleWebSearch}
          canThink={canThink}
          thinkingEnabled={thinking.enabled}
          onToggleThinking={handleToggleThinking}
          onUnavailable={showToggleNotice}
          onChangeText={setInputText}
          onSend={onSend}
          onStop={onStop}
          style={inputBarStyle}
          messageStarters={messageStarters}
          column={column}
        />
      </KeyboardStickyView>
      <Toast
        visible={webNotice !== null || toggleNotice !== null}
        message={
          webNotice
            ? t(`screens.chat.webSearchNotice.${webNotice.kind}`)
            : (toggleNotice?.message ?? '')
        }
        blurTarget={blurTargetRef}
        style={{ top: headerInset + Spacings.md }}
      />
      {embeddingPrompt.open && (
        <EmbeddingDownloadSheet
          chatModel={webChatModel}
          ramGB={ramGB}
          required={embeddingPrompt.required}
          onClose={embeddingPrompt.close}
        />
      )}
      {canAttachImage && (
        <CameraCaptureModal
          visible={attachments.cameraVisible}
          onClose={() => attachments.setCameraVisible(false)}
          onCapture={attachments.handleCapturePhoto}
        />
      )}
    </View>
  );
};
