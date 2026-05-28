import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Message } from 'react-native-nobodywho';
import { InputBar, MessageListItem } from 'components';
import { EmptyChat } from './components/EmptyChat/EmptyChat';
import { useStyled, useTabBarBottomPadding } from 'hooks';
import { useAiService } from 'services';
import { isAndroid, isIOS } from 'helpers';

import styles from './ChatScreen.styles';

const INPUT_BAR_BOTTOM_GAP = 14;

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const { colors } = useStyled();
  const { chat: currentChat } = useAiService();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  // Use useBottomTabBarHeight when available, see https://github.com/react-navigation/react-navigation/discussions/12949?sort=new
  const paddingBottom = useTabBarBottomPadding();
  const isKeyboardVisible = keyboardHeight > 0;

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages]);

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
    ? keyboardHeight + (isAndroid ? insets.bottom : 0) + INPUT_BAR_BOTTOM_GAP
    : paddingBottom + INPUT_BAR_BOTTOM_GAP;
  const footerHeight =
    paddingBottom + INPUT_BAR_BOTTOM_GAP * 2 + InputBar.height;

  const ListFooter = useMemo(
    () => <View style={{ height: footerHeight }} />,
    [footerHeight],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {messages.length === 0 ? (
        !isKeyboardVisible && <EmptyChat />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          style={styles.listContainer}
          contentContainerStyle={[styles.listContent]}
          ListFooterComponent={ListFooter}
          keyExtractor={(_, index) => index.toString()}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <MessageListItem message={item} />}
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
