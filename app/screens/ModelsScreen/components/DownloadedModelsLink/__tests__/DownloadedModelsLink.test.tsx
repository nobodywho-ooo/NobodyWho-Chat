import React from 'react';
import { render, act } from '@testing-library/react-native';

import { DownloadedModelsLink } from '../DownloadedModelsLink';

test('renders correctly DownloadedModelsLink', () => {
  const screen = render(
    <DownloadedModelsLink count={3} first onPress={jest.fn()} />,
  );
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders correctly DownloadedModelsLink when not first', () => {
  const screen = render(
    <DownloadedModelsLink count={1} first={false} onPress={jest.fn()} />,
  );
  expect(screen.toJSON()).toMatchSnapshot();
});

test('pressing the row invokes onPress', () => {
  const onPress = jest.fn();
  const screen = render(
    <DownloadedModelsLink count={2} first onPress={onPress} />,
  );

  const listItem = screen.UNSAFE_getByProps({ onPress });
  act(() => listItem.props.onPress());

  expect(onPress).toHaveBeenCalledTimes(1);
});
