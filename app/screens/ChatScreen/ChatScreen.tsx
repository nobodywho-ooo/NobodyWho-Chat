import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Message } from 'react-native-nobodywho';
import { InputBar, MessageListItem } from 'components';
import { useStyled } from 'hooks';
import { DisplayMessage } from 'types';
import { getAppState } from 'database';
import { insertConversation, insertMessage } from 'repositories';
import { useAiService } from 'services';
import { devLog, isAndroid, isIOS, formatThinkingBlocks } from 'helpers';

import { EmptyChat } from './components/EmptyChat/EmptyChat';

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
  const [isStreaming, setIsStreaming] = useState(false);
  const { colors } = useStyled();
  const { chat } = useAiService();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = keyboardHeight > 0;

  useEffect(() => {
    setMessages(formatMessages(initialMessages));
    setConversationId(initialConversationId);
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

  const handleSend = async () => {
    const userInput = inputText.trim();
    if (!userInput || isStreaming) return;

    if (chat.current === undefined) {
      return;
    }

    const activeChat = chat.current;

    const { modelIdInUse } = getAppState();
    if (modelIdInUse === undefined) {
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: userInput,
    };
    const initialAssistantMessage: Message = {
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, userMessage, initialAssistantMessage]);
    setInputText('');
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

    await insertMessage({
      conversationId: id,
      role: 'user',
      content: userInput,
      documentsPath: [],
    });

    const startedAt = Date.now();
    let firstTokenAt: number | undefined;
    let tokenCount = 0;
    let accumulated = '';
    try {
      const streamResult = activeChat.ask(userInput);

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
    } catch (error) {
      devLog('ChatScreen generation failed', error);
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
    if (chat.current !== undefined) {
      chat.current.stopGeneration();
    }
  };

  const bottomOffset = isKeyboardVisible
    ? keyboardHeight + (isAndroid ? insets.bottom : 0) + INPUT_BAR_PADDING
    : insets.bottom + INPUT_BAR_PADDING;

  const listPaddingBottom = bottomOffset + InputBar.height + INPUT_BAR_PADDING;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {messages.length === 0 ? (
        !isKeyboardVisible && <EmptyChat />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          style={styles.listContainer}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listPaddingBottom },
          ]}
          keyExtractor={(_, index) => index.toString()}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <MessageListItem message={item} />}
          onContentSizeChange={scrollToEnd}
          keyboardDismissMode="interactive"
        />
      )}
      <InputBar
        value={inputText}
        isStreaming={isStreaming}
        onChangeText={setInputText}
        onSend={handleSend}
        onStop={stopStreaming}
        style={{ bottom: bottomOffset }}
      />
    </View>
  );
};
