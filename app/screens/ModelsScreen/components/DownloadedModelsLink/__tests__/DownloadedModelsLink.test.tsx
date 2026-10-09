import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { DownloadedModelsLink } from '../DownloadedModelsLink';

test('renders correctly DownloadedModelsLink', async () => {
  const screen = await render(
    <DownloadedModelsLink count={3} first onPress={jest.fn()} />,
  );
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders correctly DownloadedModelsLink when not first', async () => {
  const screen = await render(
    <DownloadedModelsLink count={1} first={false} onPress={jest.fn()} />,
  );
  expect(screen.toJSON()).toMatchSnapshot();
});

test('pressing the row invokes onPress', async () => {
  const onPress = jest.fn();
  const screen = await render(
    <DownloadedModelsLink count={2} first onPress={onPress} />,
  );

  const [listItem] = screen.container.queryAll(
    node => node.type === 'ListItem' && node.props.onPress === onPress,
  );
  await fireEvent.press(listItem);

  expect(onPress).toHaveBeenCalledTimes(1);
});
