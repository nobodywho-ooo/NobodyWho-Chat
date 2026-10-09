import React from 'react';
import { render } from '@testing-library/react-native';

import { SystemBlock } from '../SystemBlock';

test('renders the system label and the full content inline', async () => {
  const { getByText } = await render(
    <SystemBlock content="You are a helpful assistant." />,
  );

  expect(getByText('components.messageListItem.system')).toBeTruthy();
  expect(getByText('You are a helpful assistant.')).toBeTruthy();
});

test('renders long content without truncating it', async () => {
  const content = 'A'.repeat(500);
  const { getByText } = await render(<SystemBlock content={content} />);

  expect(getByText(content)).toBeTruthy();
});

test('matches the snapshot', async () => {
  const { toJSON } = await render(
    <SystemBlock content="You are a helpful assistant." />,
  );
  expect(toJSON()).toMatchSnapshot();
});
