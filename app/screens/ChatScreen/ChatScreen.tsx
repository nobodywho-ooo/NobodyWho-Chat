import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareLegendList } from '@legendapp/list/keyboard';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { BlurTargetView, BlurView } from 'expo-blur';
import LinearGradient from 'react-native-linear-gradient';
import { MessageListItem, ScrollToBottomButton } from 'components';
import { useTheme } from 'context';
import { useAppState, useStyled } from 'hooks';
import {
  DisplayMessage,
  pipelineIngestsAudio,
  pipelineIngestsImage,
} from 'types';
import { AiModelState, useAiService } from 'services';
import { isAndroid } from 'helpers';
import { Theme } from 'types';

import { CameraCaptureModal, InputBar, MessageStarters } from './components';
import {
  useAttachments,
  useChatGeneration,
  useMessageListScroll,
  useSttTranscription,
  useTtsPlayback,
} from './hooks';
import styles from './ChatScreen.styles';

const INPUT_BAR_PADDING = 14;

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
  onConversationCreated: (conversationId: number) => void;
  disabled?: boolean;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  conversationId: initialConversationId,
  messages: initialMessages,
  onConversationCreated,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { chat, chatPipeline, chatThinkOpen, ttsState, sttState } =
    useAiService();
  const { ttsModelIdInUse, sttModelIdInUse } = useAppState();

  const canPlayAudio =
    ttsModelIdInUse !== undefined && ttsState === AiModelState.Ready;
  const canDictate =
    sttModelIdInUse !== undefined && sttState === AiModelState.Ready;
  const {
    playingIndex,
    loadingIndex: audioLoadingIndex,
    play: playAudio,
    stop: stopAudio,
  } = useTtsPlayback();
  const [inputText, setInputText] = useState('');
  const {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useSttTranscription({
    onTranscribed: text =>
      setInputText(prev => (prev.trim() ? `${prev.trimEnd()} ${text}` : text)),
    onPermissionDenied: () =>
      Alert.alert(
        t('components.inputBar.microphoneDeniedTitle'),
        t('components.inputBar.microphoneDeniedMessage'),
      ),
  });
  const [messages, setMessages] = useState<DisplayMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [attachExpanded, setAttachExpanded] = useState(false);

  const blurTargetRef = useRef<View>(null);
  const previousConversationIdRef = useRef<number | undefined | 'mount'>(
    'mount',
  );

  const list = useMessageListScroll(messages);

  const ingestsImage = pipelineIngestsImage(chatPipeline);
  const ingestsAudio = pipelineIngestsAudio(chatPipeline);

  const attachments = useAttachments({ ingestsImage, ingestsAudio });
  const { clearAllAttachments } = attachments;

  const { isStreaming, handleSend, stopStreaming } = useChatGeneration({
    chat,
    thinkOpen: chatThinkOpen,
    ingestsImage,
    ingestsAudio,
    inputText,
    setInputText,
    setMessages,
    conversationId,
    setConversationId,
    onConversationCreated,
    attachments,
    messages,
    onTurnStart: list.anchorSentMessage,
  });

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    const previous = previousConversationIdRef.current;
    previousConversationIdRef.current = initialConversationId;

    const isSameConversation =
      previous === initialConversationId ||
      (previous === undefined && initialConversationId !== undefined);

    if (isSameConversation) {
      return;
    }

    setConversationId(initialConversationId);
    setAttachExpanded(false);
    clearAllAttachments();
    stopAudio();
    cancelRecording();
    list.showConversation();
  }, [
    initialConversationId,
    clearAllAttachments,
    stopAudio,
    cancelRecording,
    list,
  ]);

  // Switching models => Drop the attachments whenever the pipeline's capabilities change,
  useEffect(() => {
    setAttachExpanded(false);
    clearAllAttachments();
  }, [ingestsImage, ingestsAudio, clearAllAttachments]);

  const renderMessage = useCallback(
    ({ item, index }: { item: DisplayMessage; index: number }) => (
      <MessageListItem
        message={item}
        isStreaming={isStreaming && index === messages.length - 1}
        index={index}
        canPlayAudio={canPlayAudio}
        isAudioLoading={audioLoadingIndex === index}
        isAudioPlaying={playingIndex === index}
        onPlayAudio={playAudio}
        onStopAudio={stopAudio}
      />
    ),
    [
      isStreaming,
      messages.length,
      canPlayAudio,
      audioLoadingIndex,
      playingIndex,
      playAudio,
      stopAudio,
    ],
  );

  const hasMessages = messages.length > 0;

  const messageStarters = messages.length === 0 && !attachExpanded && (
    <MessageStarters
      pipeline={chatPipeline}
      onSelect={setInputText}
      disabled={disabled}
    />
  );

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
          <KeyboardAwareLegendList
            ref={list.listRef}
            data={messages}
            style={styles.listContainer}
            contentContainerStyle={styles.listContent}
            keyExtractor={(_, index) => index.toString()}
            showsVerticalScrollIndicator={false}
            renderItem={renderMessage}
            ListEmptyComponent={EmptyArea}
            recycleItems={false}
            anchoredEndSpace={list.anchoredEndSpace}
            maintainVisibleContentPosition={list.maintainVisibleContentPosition}
            onScrollBeginDrag={list.onScrollBeginDrag}
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
        <ScrollToBottomButton
          visible={hasMessages && list.canScrollToBottom}
          onPress={list.scrollToBottom}
          blurTarget={blurTargetRef}
          style={styles.scrollToBottomContainer}
        />
        <InputBar
          composerRef={list.composerRef}
          onComposerLayout={list.onComposerLayout}
          value={inputText}
          isStreaming={isStreaming}
          disabled={disabled}
          attachExpanded={attachExpanded}
          onAttachExpandedChange={setAttachExpanded}
          showImageAttach={ingestsImage}
          showAudioAttach={ingestsAudio}
          imageSource={attachments.attachedDocuments?.imageSource}
          hasAudio={!!attachments.attachedDocuments?.audioPath}
          onAttachImage={attachments.handleAttachImage}
          onAttachCamera={attachments.handleAttachCamera}
          onAttachAudio={attachments.handleAttachAudio}
          showDictation={canDictate}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          onStartDictation={startRecording}
          onStopDictation={stopRecording}
          onChangeText={setInputText}
          onSend={handleSend}
          onStop={stopStreaming}
          style={{ paddingBottom: insets.bottom + INPUT_BAR_PADDING }}
          messageStarters={messageStarters}
        />
      </KeyboardStickyView>
      {ingestsImage && (
        <CameraCaptureModal
          visible={attachments.cameraVisible}
          onClose={() => attachments.setCameraVisible(false)}
          onCapture={attachments.handleCapturePhoto}
        />
      )}
    </View>
  );
};
