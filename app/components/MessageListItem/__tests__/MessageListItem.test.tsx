import React from 'react';
import { render } from '@testing-library/react-native';
import { Message } from 'react-native-nobodywho';

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
