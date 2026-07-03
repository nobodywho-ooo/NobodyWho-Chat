import React from 'react';
import { render } from '@testing-library/react-native';
import { Message } from 'react-native-nobodywho';

import { MessageListItem } from 'components';
import { AiServiceProvider } from 'services';
import { ChatScreen } from '../ChatScreen';

// The starter selection is random; pin it so the snapshot stays stable.
jest.mock('../components/MessageStarters/starters', () => ({
  pickStarterIds: () => ['planParisTrip', 'summarizeText'],
}));

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
  // No message sent yet, so the starters are offered above the input bar.
  expect(
    screen.getByText('components.messageStarters.planParisTrip.title'),
  ).toBeTruthy();
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
