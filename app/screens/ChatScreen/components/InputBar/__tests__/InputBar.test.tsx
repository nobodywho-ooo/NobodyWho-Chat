import React from 'react';
import { render } from '@testing-library/react-native';

import { InputBar } from '../InputBar';

jest.unmock('../InputBar');

const foo = () => {
  // do nothing.
};

test('renders correctly InputBar', () => {
  const tree = render(
    <InputBar
      value={''}
      isStreaming={false}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
    />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly InputBar with value', () => {
  const tree = render(
    <InputBar
      value={'Type here'}
      isStreaming={false}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
    />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly InputBar when streaming', () => {
  const tree = render(
    <InputBar
      value={''}
      isStreaming={true}
      onChangeText={foo}
      onSend={foo}
      onStop={foo}
    />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});
