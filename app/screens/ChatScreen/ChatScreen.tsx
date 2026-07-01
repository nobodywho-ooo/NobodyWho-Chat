import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { MessageListItem } from 'components';
import { useStyled } from 'hooks';
import {
  DisplayMessage,
  pipelineIngestsAudio,
  pipelineIngestsImage,
} from 'types';
import { useAiService } from 'services';
import { isAndroid } from 'helpers';

import { CameraCaptureModal, EmptyChat, InputBar } from './components';
import { useAttachments, useChatGeneration, useKeyboardHeight } from './hooks';
import styles from './ChatScreen.styles';

const INPUT_BAR_PADDING = 14;

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
  const insets = useSafeAreaInsets();
  const { chat, chatPipeline } = useAiService();
  const flatListRef = useRef<FlashListRef<DisplayMessage>>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
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
      <InputBar
        value={inputText}
        isStreaming={isStreaming}
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
