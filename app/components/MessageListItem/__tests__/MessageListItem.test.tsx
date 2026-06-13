import React from 'react';
import { render } from '@testing-library/react-native';
import { Message } from 'react-native-nobodywho';
import { DisplayMessage } from 'types';

import { MessageListItem } from '../MessageListItem';

jest.unmock('../MessageListItem');

test('renders correctly MessageListItem for user', () => {
  const message: Message = { role: 'user', content: 'Is the water wet?' };
  const tree = render(<MessageListItem message={message} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly MessageListItem for assistant', () => {
  const message: Message = {
    role: 'assistant',
    content: 'Yes, the water is wet',
  };
  const tree = render(<MessageListItem message={message} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('shows tokens/sec and time-to-first-token under a streamed message', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'Yes, the water is wet',
    tokensPerSecond: 42.73,
    timeToFirstToken: 153,
  };
  const { getByText } = render(<MessageListItem message={message} />);
  expect(getByText('42.7 tok/s · 153 ms')).toBeTruthy();
});

test('formats time-to-first-token in seconds once it passes a second', () => {
  const message: DisplayMessage = {
    role: 'assistant',
    content: 'done',
    tokensPerSecond: 8,
    timeToFirstToken: 1500,
  };
  const { getByText } = render(<MessageListItem message={message} />);
  expect(getByText('8.0 tok/s · 1.5 s')).toBeTruthy();
});

test('shows no metrics for an assistant message without them', () => {
  const message: Message = { role: 'assistant', content: 'no metrics' };
  const { queryByText } = render(<MessageListItem message={message} />);
  expect(queryByText(/tok\/s/)).toBeNull();
});
