import React from 'react';
import { render } from '@testing-library/react-native';
import { ChatMessage, Role } from 'react-native-nobodywho';

import { MessageListItem } from '../MessageListItem';

jest.unmock('../MessageListItem');

test('renders correctly MessageListItem', () => {
  const message: ChatMessage = { role: Role.User, content: 'What is water?' };
  const tree = render(<MessageListItem message={message} />).toJSON();
  expect(tree).toMatchSnapshot();
});
