import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Message } from 'react-native-nobodywho';
import { InputBar, MessageListItem } from 'components';
import { EmptyChat } from './components/EmptyChat/EmptyChat';
import { useStyled } from 'hooks';
import { useAiService } from 'services';
import { isAndroid, isIOS } from 'helpers';

import styles from './ChatScreen.styles';

const INPUT_BAR_PADDING = 14;

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const { colors } = useStyled();
  const { chat: currentChat } = useAiService();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = keyboardHeight > 0;

  const scrollToEnd = useCallback(
    (_width: number, contentHeight: number) => {
      flatListRef.current?.scrollToOffset({
        offset: contentHeight,
        animated: false,
      });
    },
    [],
  );

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

    try {
      let accumulated = '';
      const streamResult = chat.ask(userInput);

      for await (const token of streamResult) {
        accumulated += token;
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            content: accumulated,
          };
          return next;
        });
      }
    } catch (error) {
      console.error('Chat generation failed:', error);
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
