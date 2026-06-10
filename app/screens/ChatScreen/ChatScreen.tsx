import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Message } from 'react-native-nobodywho';
import { InputBar, MessageListItem } from 'components';
import { useStyled } from 'hooks';
import { useAiService } from 'services';
import { devLog, isAndroid, isIOS, formatThinkingBlocks } from 'helpers';

import { EmptyChat } from './components/EmptyChat/EmptyChat';

import styles from './ChatScreen.styles';

const INPUT_BAR_PADDING = 14;

interface ChatScreenProps {
  messages: Message[];
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  messages: initialMessages,
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const { colors } = useStyled();
  const { chat: currentChat } = useAiService();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = keyboardHeight > 0;

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Don't let a generation keep streaming into a screen that is gone.
  // Reading the ref at cleanup time is deliberate: the chat instance may
  // have been recreated since mount and we must stop the current one.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      currentChat.current?.stopGeneration();
    };
  }, [currentChat]);

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

    const chat = currentChat.current;

    if (!chat) {
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
      const streamResult = chat.ask(userInput);

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
    } catch (error) {
      devLog('ChatScreen generation failed', error);
      // Surface the failure in the assistant bubble (after any partial
      // output) instead of leaving it empty forever.
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
    const chat = currentChat.current;

    if (!chat) {
      return;
    }

    chat.stopGeneration();
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
