import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { BlurTargetView, BlurView } from 'expo-blur';
import LinearGradient from 'react-native-linear-gradient';
import { MessageListItem } from 'components';
import { useTheme } from 'context';
import { useStyled } from 'hooks';
import {
  DisplayMessage,
  pipelineIngestsAudio,
  pipelineIngestsImage,
} from 'types';
import { useAiService } from 'services';
import { isAndroid } from 'helpers';
import { Theme } from 'types';

import { CameraCaptureModal, EmptyChat, InputBar } from './components';
import { useAttachments, useChatGeneration, useKeyboardHeight } from './hooks';
import styles from './ChatScreen.styles';

const INPUT_BAR_PADDING = 14;

const gradientColors: Record<Theme, string[]> = {
  light: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)'],
  dark: ['rgba(18, 18, 18, 0)', 'rgba(18, 18, 18, 0.9)'],
};

interface ChatScreenProps {
  conversationId: number | undefined;
  messages: DisplayMessage[];
  onConversationCreated: (conversationId: number) => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  conversationId: initialConversationId,
  messages: initialMessages,
  onConversationCreated,
}) => {
  const { colors } = useStyled();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { chat, chatPipeline } = useAiService();
  const flatListRef = useRef<FlashListRef<DisplayMessage>>(null);
  const blurTargetRef = useRef<View>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [attachExpanded, setAttachExpanded] = useState(false);
  const [stableHeight, setStableHeight] = useState(0);

  const { keyboardHeight, isKeyboardVisible } = useKeyboardHeight();
  const ingestsImage = pipelineIngestsImage(chatPipeline);
  const ingestsAudio = pipelineIngestsAudio(chatPipeline);

  const attachments = useAttachments({ ingestsImage, ingestsAudio });
  const { clearAllAttachments } = attachments;
  const { isStreaming, handleSend, stopStreaming } = useChatGeneration({
    chat,
    ingestsImage,
    ingestsAudio,
    inputText,
    setInputText,
    setMessages,
    conversationId,
    setConversationId,
    onConversationCreated,
    attachments,
    flatListRef,
  });

  useEffect(() => {
    setMessages(initialMessages);
    setConversationId(initialConversationId);
    setAttachExpanded(false);
    clearAllAttachments();
  }, [initialMessages, initialConversationId, clearAllAttachments]);

  const scrollToEnd = useCallback((_width: number, contentHeight: number) => {
    flatListRef.current?.scrollToOffset({
      offset: contentHeight,
      animated: false,
    });
  }, []);

  let bottomOffset: number;
  if (!isKeyboardVisible) {
    bottomOffset = insets.bottom + INPUT_BAR_PADDING;
  } else if (isAndroid) {
    bottomOffset = keyboardHeight + INPUT_BAR_PADDING + insets.bottom;
  } else {
    bottomOffset = keyboardHeight + INPUT_BAR_PADDING;
  }

  const listPaddingBottom = bottomOffset + InputBar.height + INPUT_BAR_PADDING;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface }]}
      onLayout={e => {
        if (!isInputFocused && !isKeyboardVisible) {
          setStableHeight(e.nativeEvent.layout.height);
        }
      }}
    >
      <Pressable
        style={styles.dismissOverlay}
        onPress={Keyboard.dismiss}
        accessible={false}
      />
      <BlurTargetView ref={blurTargetRef} style={styles.blurTargetContainer}>
        {messages.length === 0 ? (
          !isInputFocused &&
          stableHeight > 0 && (
            <View style={[styles.emptyChatContainer, { height: stableHeight }]}>
              <EmptyChat />
            </View>
          )
        ) : (
          <FlashList
            ref={flatListRef}
            data={messages}
            style={styles.listContainer}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: listPaddingBottom },
            ]}
            keyExtractor={(_, index) => index.toString()}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <MessageListItem
                message={item}
                isStreaming={isStreaming && index === messages.length - 1}
              />
            )}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={isAndroid ? 'on-drag' : 'interactive'}
          />
        )}
      </BlurTargetView>
      {attachExpanded && (
        <Pressable
          style={styles.blurOverlay}
          onPress={() => setAttachExpanded(false)}
          accessible={false}
        >
          <BlurView
            style={styles.blurFill}
            intensity={16}
            tint={theme}
            blurMethod="dimezisBlurViewSdk31Plus"
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
      <InputBar
        value={inputText}
        isStreaming={isStreaming}
        attachExpanded={attachExpanded}
        onAttachExpandedChange={setAttachExpanded}
        showImageAttach={ingestsImage}
        showAudioAttach={ingestsAudio}
        imageSource={attachments.attachedDocuments?.imageSource}
        hasAudio={!!attachments.attachedDocuments?.audioPath}
        onAttachImage={attachments.handleAttachImage}
        onAttachCamera={attachments.handleAttachCamera}
        onAttachAudio={attachments.handleAttachAudio}
        onChangeText={setInputText}
        onSend={handleSend}
        onStop={stopStreaming}
        onFocus={() => setIsInputFocused(true)}
        onBlur={() => setIsInputFocused(false)}
        style={{ paddingBottom: bottomOffset }}
      />
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
