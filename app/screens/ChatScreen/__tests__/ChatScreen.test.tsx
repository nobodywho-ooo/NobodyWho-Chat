import React from 'react';
import { render } from '@testing-library/react-native';
import { Message } from 'react-native-nobodywho';

import { MessageListItem } from 'components';
import { AiServiceProvider } from 'services';
import { ChatScreen } from '../ChatScreen';

test('renders correctly empty ChatScreen', () => {
  const tree = render(
    <AiServiceProvider>
      <ChatScreen
        conversationId={undefined}
        messages={[]}
        onConversationCreated={jest.fn()}
      />
    </AiServiceProvider>,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders ChatScreen with existing messages', () => {
  const messages: Message[] = [
    { role: 'user', content: 'Hello there' },
    { role: 'assistant', content: 'Hi! How can I help you?' },
  ];

  const { toJSON } = render(
    <AiServiceProvider>
      <ChatScreen
        conversationId={5}
        messages={messages}
        onConversationCreated={jest.fn()}
      />
    </AiServiceProvider>,
  );

  const serialized = JSON.stringify(toJSON());
  // The user message content is rendered into the list (not the empty state).
  expect(serialized).toContain('Hello there');
  expect(toJSON()).toMatchSnapshot();
});

test('formats <think> blocks in initial assistant messages', () => {
  const messages: Message[] = [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: '<think>reasoning</think>answer', toolCalls: [] },
  ];

  const screen = render(
    <AiServiceProvider>
      <ChatScreen
        conversationId={5}
        messages={messages}
        onConversationCreated={jest.fn()}
      />
    </AiServiceProvider>,
  );

  const items = screen.UNSAFE_getAllByType(MessageListItem);
  // Reasoning is blockquoted for display; the raw <think> tags are gone.
  expect(items[1].props.message.content).toBe('> reasoning\n\nanswer');
  // The user message passes through untouched.
  expect(items[0].props.message.content).toBe('hi');
});
