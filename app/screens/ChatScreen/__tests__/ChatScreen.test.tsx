import React from 'react';
import { render } from '@testing-library/react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { StreamdownText } from 'react-native-streamdown';

import { AiServiceProvider } from 'services';
import { DisplayMessage } from 'types';
import { ChatScreen } from '../ChatScreen';

// The starter selection is random; pin it so the snapshot stays stable.
jest.mock('../components/MessageStarters/starters', () => ({
  pickStarterIds: () => ['planParisTrip', 'summarizeText'],
}));

test('renders correctly empty ChatScreen', async () => {
  const screen = await render(
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

test('renders ChatScreen with existing messages', async () => {
  const messages: DisplayMessage[] = [
    { role: 'user', content: 'Hello there' },
    { role: 'assistant', content: 'Hi! How can I help you?' },
  ];

  const { toJSON } = await render(
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

test('passes raw <think> blocks through to MessageListItem', async () => {
  const messages: DisplayMessage[] = [
    { role: 'user', content: 'hi' },
    {
      role: 'assistant',
      content: '<think>reasoning</think>answer',
      toolCalls: [],
    },
  ];
  jest.mocked(StreamdownText).mockClear();
  jest.mocked(EnrichedMarkdownText).mockClear();

  const screen = await render(
    <AiServiceProvider>
      <ChatScreen
        conversationId={5}
        messages={messages}
        onConversationCreated={jest.fn()}
      />
    </AiServiceProvider>,
  );

  // The raw <think> tags are kept; MessageListItem renders the reasoning in a
  // dedicated ThinkingBlock rather than ChatScreen pre-formatting it.
  expect(
    screen.getByLabelText('components.messageListItem.viewThinking'),
  ).toBeOnTheScreen();
  expect(
    jest.mocked(StreamdownText).mock.calls.map(([props]) => props.markdown),
  ).toContain('reasoning');
  expect(jest.mocked(EnrichedMarkdownText).mock.lastCall?.[0].markdown).toBe(
    'answer',
  );
  // The user message passes through untouched.
  expect(screen.getByText('hi')).toBeOnTheScreen();
});
