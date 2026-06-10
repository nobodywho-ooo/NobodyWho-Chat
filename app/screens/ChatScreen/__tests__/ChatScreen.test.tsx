import React from 'react';
import { render } from '@testing-library/react-native';
import { Message } from 'react-native-nobodywho';

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
