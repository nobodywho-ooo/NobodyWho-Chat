import React from 'react';
import { render } from '@testing-library/react-native';
import { Message } from 'react-native-nobodywho';

import { MessageListItem } from 'components';
import { AiServiceProvider } from 'services';
import { fireContainerLayout } from 'jest/layout';
import { ChatScreen } from '../ChatScreen';

test('renders correctly empty ChatScreen', () => {
  const screen = render(
    <AiServiceProvider>
      <ChatScreen
        conversationId={undefined}
        messages={[]}
        onConversationCreated={jest.fn()}
      />
    </AiServiceProvider>,
  );
  // The empty state only mounts once the container has measured its height.
  fireContainerLayout(screen);
  expect(screen.toJSON()).toMatchSnapshot();
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

test('passes raw <think> blocks through to MessageListItem', () => {
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
  // The raw <think> tags are kept; MessageListItem renders the reasoning in a
  // dedicated ThinkingBlock rather than ChatScreen pre-formatting it.
  expect(items[1].props.message.content).toBe('<think>reasoning</think>answer');
  // The user message passes through untouched.
  expect(items[0].props.message.content).toBe('hi');
});
