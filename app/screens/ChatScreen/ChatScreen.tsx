import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Message } from 'react-native-nobodywho';
import { InputBar, MessageListItem } from 'components';
import { useStyled } from 'hooks';
import { getAppState } from 'database';
import { insertConversation, insertMessage } from 'repositories';
import { useAiService } from 'services';
import { devLog, isAndroid, isIOS, formatThinkingBlocks } from 'helpers';

import { EmptyChat } from './components/EmptyChat/EmptyChat';

import styles from './ChatScreen.styles';

const INPUT_BAR_PADDING = 14;

interface ChatScreenProps {
  conversationId: number | undefined;
  messages: Message[];
  onConversationCreated: (conversationId: number) => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  conversationId: initialConversationId,
  messages: initialMessages,
  onConversationCreated,
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
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
    setMessages(initialMessages);
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

    let accumulated = '';
    try {
      const streamResult = chat.current.ask(userInput);

      for await (const token of streamResult) {
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

      const isNewConversation = conversationId === undefined;
      const id = isNewConversation
        ? await insertConversation({ title: userInput, modelId: modelIdInUse })
        : conversationId;

      await insertMessage({
        conversationId: id,
        role: 'user',
        content: userInput,
        documentsPath: [],
      });
      await insertMessage({
        conversationId: id,
        role: 'assistant',
        content: accumulated,
        documentsPath: [],
      });

      if (isNewConversation) {
        setConversationId(id);
        onConversationCreated(id);
      }
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
