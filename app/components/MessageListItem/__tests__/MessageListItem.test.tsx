import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Message } from 'react-native-nobodywho';
import { copyToClipboard } from 'helpers';
import { DisplayMessage } from 'types';

import { MessageListItem } from '../MessageListItem';

jest.unmock('../MessageListItem');

afterEach(() => {
  jest.clearAllMocks();
});

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

test('copies the assistant message content to the clipboard when pressed', () => {
  const message: Message = {
    role: 'assistant',
    content: 'Yes, the water is wet',
  };
  const { getByRole } = render(<MessageListItem message={message} />);
  fireEvent.press(getByRole('button'));
  expect(copyToClipboard).toHaveBeenCalledWith('Yes, the water is wet');
});

test('shows a copied confirmation after copying, then reverts', () => {
  jest.useFakeTimers();
  const message: Message = { role: 'assistant', content: 'copy me' };
  const { getByRole, getByText, queryByText } = render(
    <MessageListItem message={message} />,
  );

  expect(getByText('components.messageListItem.copy')).toBeTruthy();

  fireEvent.press(getByRole('button'));
  expect(getByText('components.messageListItem.copied')).toBeTruthy();

  act(() => {
    jest.runAllTimers();
  });
  expect(queryByText('components.messageListItem.copied')).toBeNull();
  expect(getByText('components.messageListItem.copy')).toBeTruthy();

  jest.useRealTimers();
});

test('does not render a copy button for user messages', () => {
  const message: Message = { role: 'user', content: 'hello' };
  const { queryByRole } = render(<MessageListItem message={message} />);
  expect(queryByRole('button')).toBeNull();
});

test('does not render a copy button while an assistant message is still empty', () => {
  const message: Message = { role: 'assistant', content: '' };
  const { queryByRole } = render(<MessageListItem message={message} />);
  expect(queryByRole('button')).toBeNull();
});
