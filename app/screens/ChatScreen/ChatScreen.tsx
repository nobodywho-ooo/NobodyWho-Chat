import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Message, Prompt } from 'react-native-nobodywho';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { MessageListItem } from 'components';
import { useStyled } from 'hooks';
import {
  DisplayMessage,
  pipelineIngestsAudio,
  pipelineIngestsImage,
} from 'types';
import { getAppState } from 'database';
import { insertConversation, insertMessage } from 'repositories';
import { useAiService } from 'services';
import {
  log,
  isIOS,
  formatThinkingBlocks,
  isAndroid,
  haptics,
  captureImageToMessageDocuments,
  deleteMessageDocuments,
  pickAudioToMessageDocuments,
  pickImageToMessageDocuments,
  resolveMessageDocumentPath,
} from 'helpers';

import { CameraCaptureModal, EmptyChat, InputBar } from './components';
import { CapturedPhoto } from './components/CameraCaptureModal/CameraCaptureModal';
import { ImageAttachSource } from './components/InputBar/InputBar';
import styles from './ChatScreen.styles';

const INPUT_BAR_PADDING = 14;

// Persisted assistant messages keep their raw <think>…</think> blocks; render
// them the same way live streaming does (see handleSend) so a reloaded
// conversation looks identical to one being streamed.
const formatMessages = (messages: DisplayMessage[]): DisplayMessage[] =>
  messages.map(message =>
    message.role === 'assistant'
      ? { ...message, content: formatThinkingBlocks(message.content) }
      : message,
  );

const computeGenerationMetrics = (
  startedAt: number,
  firstTokenAt: number | undefined,
  tokenCount: number,
): { tokensPerSecond?: number; timeToFirstToken?: number } => {
  if (firstTokenAt === undefined || tokenCount === 0) return {};
  const timeToFirstToken = firstTokenAt - startedAt;
  const generationMs = Math.max(Date.now() - firstTokenAt, 1);
  return {
    tokensPerSecond: tokenCount / (generationMs / 1000),
    timeToFirstToken,
  };
};

interface ChatScreenProps {
  conversationId: number | undefined;
  messages: DisplayMessage[];
  onConversationCreated: (conversationId: number) => void;
}

interface AttachedDocuments {
  imagePath?: string;
  imageSource?: ImageAttachSource;
  audioPath?: string;
}

const pendingDocumentPaths = (documents: AttachedDocuments | null): string[] =>
  [documents?.imagePath, documents?.audioPath].filter(
    (path): path is string => typeof path === 'string',
  );

export const ChatScreen: React.FC<ChatScreenProps> = ({
  conversationId: initialConversationId,
  messages: initialMessages,
  onConversationCreated,
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<DisplayMessage[]>(() =>
    formatMessages(initialMessages),
  );
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [stableHeight, setStableHeight] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedDocuments, setAttachedDocuments] =
    useState<AttachedDocuments | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const { colors } = useStyled();
  const { chat, chatPipeline } = useAiService();
  const flatListRef = useRef<FlashListRef<DisplayMessage>>(null);
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = keyboardHeight > 0;

  const ingestsImage = pipelineIngestsImage(chatPipeline);
  const ingestsAudio = pipelineIngestsAudio(chatPipeline);

  const attachedDocumentsRef = useRef(attachedDocuments);
  attachedDocumentsRef.current = attachedDocuments;

  useEffect(() => {
    setMessages(formatMessages(initialMessages));
    setConversationId(initialConversationId);
    const orphans = pendingDocumentPaths(attachedDocumentsRef.current);
    if (orphans.length > 0) {
      deleteMessageDocuments(orphans);
      setAttachedDocuments(null);
    }
  }, [initialMessages, initialConversationId]);

  // Don't let a generation keep streaming into a screen that is gone.
  // Reading the ref at cleanup time is deliberate: the chat instance may
  // have been recreated since mount and we must stop the current one.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      chat.current?.stopGeneration();
    };
  }, [chat]);

  useEffect(() => {
    return () => {
      const orphans = pendingDocumentPaths(attachedDocumentsRef.current);
      if (orphans.length > 0) {
        deleteMessageDocuments(orphans);
      }
    };
  }, []);

  const scrollToEnd = useCallback((_width: number, contentHeight: number) => {
    flatListRef.current?.scrollToOffset({
      offset: contentHeight,
      animated: false,
    });
  }, []);

  useEffect(() => {
    const showEvent = isIOS ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = isIOS ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const clearAttachedImage = () => {
    const imagePath = attachedDocuments?.imagePath;
    if (imagePath) {
      deleteMessageDocuments([imagePath]);
    }
    setAttachedDocuments(prev =>
      prev ? { ...prev, imagePath: undefined, imageSource: undefined } : prev,
    );
  };

  const handleAttachImage = async () => {
    if (!ingestsImage) {
      return;
    }

    if (attachedDocuments?.imagePath) {
      clearAttachedImage();
      return;
    }

    try {
      const imagePath = await pickImageToMessageDocuments();
      if (imagePath) {
        setAttachedDocuments(prev => ({
          ...prev,
          imagePath,
          imageSource: 'photo',
        }));
        haptics.light();
      }
    } catch (error) {
      log('ChatScreen attach image failed', error, { capture: true });
    }
  };

  const handleAttachCamera = () => {
    if (!ingestsImage) {
      return;
    }

    if (attachedDocuments?.imagePath) {
      clearAttachedImage();
      return;
    }

    Keyboard.dismiss();
    setCameraVisible(true);
  };

  const handleCapturePhoto = async (photo: CapturedPhoto) => {
    setCameraVisible(false);

    try {
      const imagePath = await captureImageToMessageDocuments(photo);
      setAttachedDocuments(prev => ({
        ...prev,
        imagePath,
        imageSource: 'camera',
      }));
      haptics.light();
    } catch (error) {
      log('ChatScreen capture image failed', error, { capture: true });
    }
  };

  const handleAttachAudio = async () => {
    if (!ingestsAudio) {
      return;
    }

    if (attachedDocuments?.audioPath) {
      deleteMessageDocuments([attachedDocuments.audioPath]);
      setAttachedDocuments(prev =>
        prev ? { ...prev, audioPath: undefined } : prev,
      );
      return;
    }

    try {
      const audioPath = await pickAudioToMessageDocuments();
      if (audioPath) {
        setAttachedDocuments(prev => ({ ...prev, audioPath }));
        haptics.light();
      }
    } catch (error) {
      log('ChatScreen attach audio failed', error, { capture: true });
    }
  };

  const handleSend = async () => {
    const userInput = inputText.trim();
    if (!userInput || isStreaming) return;

    const activeChat = chat.current;
    if (activeChat === undefined) {
      return;
    }

    const { modelIdInUse } = getAppState();
    if (modelIdInUse === undefined) {
      return;
    }

    const imagePath = ingestsImage ? attachedDocuments?.imagePath : undefined;
    const audioPath = ingestsAudio ? attachedDocuments?.audioPath : undefined;
    const documentsPath = [imagePath, audioPath].filter(
      (path): path is string => typeof path === 'string',
    );

    // TODO: check
    const userMessage: DisplayMessage = {
      role: 'user',
      content: userInput,
      documentsPath,
    };
    const initialAssistantMessage: Message = {
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, userMessage, initialAssistantMessage]);
    setInputText('');

    const sentPaths = new Set(documentsPath);
    const orphans = pendingDocumentPaths(attachedDocuments).filter(
      path => !sentPaths.has(path),
    );
    if (orphans.length > 0) {
      deleteMessageDocuments(orphans);
    }
    setAttachedDocuments(null);
    Keyboard.dismiss();
    setIsStreaming(true);

    const isNewConversation = conversationId === undefined;
    const id = isNewConversation
      ? await insertConversation({ title: userInput, modelId: modelIdInUse })
      : conversationId;

    if (isNewConversation) {
      setConversationId(id);
      onConversationCreated(id);
    }

    haptics.light();
    await insertMessage({
      conversationId: id,
      role: 'user',
      content: userInput,
      documentsPath,
    });

    const startedAt = Date.now();
    let firstTokenAt: number | undefined;
    let tokenCount = 0;
    let accumulated = '';
    try {
      const askInput =
        imagePath || audioPath
          ? new Prompt([
              Prompt.Text(userInput),
              ...(imagePath
                ? [Prompt.Image(resolveMessageDocumentPath(imagePath))]
                : []),
              ...(audioPath
                ? [Prompt.Audio(resolveMessageDocumentPath(audioPath))]
                : []),
            ])
          : userInput;
      const streamResult = activeChat.ask(askInput);

      for await (const token of streamResult) {
        if (chat.current !== activeChat) break;
        if (firstTokenAt === undefined) firstTokenAt = Date.now();
        tokenCount += 1;
        accumulated += token;
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            content: formatThinkingBlocks(accumulated),
          };
          return next;
        });
      }

      if (chat.current !== activeChat) {
        return;
      }

      const metrics = computeGenerationMetrics(
        startedAt,
        firstTokenAt,
        tokenCount,
      );

      // Re-stamp the just-finished assistant message with its metrics so
      // MessageListItem can render them beneath the streamed content.
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: formatThinkingBlocks(accumulated),
          ...metrics,
        };
        return next;
      });

      await insertMessage({
        conversationId: id,
        role: 'assistant',
        content: accumulated,
        documentsPath: [],
        ...metrics,
      });
      haptics.medium();
    } catch (error) {
      log('ChatScreen generation failed', error);
      const failure = t('screens.chat.generationFailed');
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: accumulated
            ? `${formatThinkingBlocks(accumulated)}\n\n${failure}`
            : failure,
        };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    chat.current?.stopGeneration();
  };

  let bottomOffset: number;
  if (!isKeyboardVisible) {
    bottomOffset = insets.bottom + INPUT_BAR_PADDING;
  } else if (isAndroid) {
    bottomOffset = INPUT_BAR_PADDING;
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
        imageSource={attachedDocuments?.imageSource}
        hasAudio={!!attachedDocuments?.audioPath}
        onAttachImage={handleAttachImage}
        onAttachCamera={handleAttachCamera}
        onAttachAudio={handleAttachAudio}
        onChangeText={setInputText}
        onSend={handleSend}
        onStop={stopStreaming}
        onFocus={() => setIsInputFocused(true)}
        onBlur={() => setIsInputFocused(false)}
        style={{ paddingBottom: bottomOffset }}
      />
      {ingestsImage && (
        <CameraCaptureModal
          visible={cameraVisible}
          onClose={() => setCameraVisible(false)}
          onCapture={handleCapturePhoto}
        />
      )}
    </View>
  );
};
