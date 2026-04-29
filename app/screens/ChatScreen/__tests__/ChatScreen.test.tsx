import React from 'react';
import { render } from '@testing-library/react-native';

import { AiServiceProvider } from 'services';
import { ChatScreen } from '../ChatScreen';

test('renders correctly ChatScreen', () => {
  const tree = render(
    <AiServiceProvider>
      <ChatScreen />
    </AiServiceProvider>,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});
