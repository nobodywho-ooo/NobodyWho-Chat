import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StreamdownText } from 'react-native-streamdown';

import { ThinkingBlock } from '../ThinkingBlock';

const mockStreamdown = StreamdownText as unknown as jest.Mock;

afterEach(() => {
  jest.clearAllMocks();
});

test('shows the "thought" label when not active', () => {
  const { getByText } = render(
    <ThinkingBlock thinking="reasoning" active={false} onPress={jest.fn()} />,
  );

  expect(getByText('components.messageListItem.thought')).toBeTruthy();
});

test('shows the "thinking" label while active', () => {
  const { getByText } = render(
    <ThinkingBlock thinking="reasoning" active onPress={jest.fn()} />,
  );

  expect(getByText('components.messageListItem.thinking')).toBeTruthy();
});

test('renders the reasoning into the preview with blank lines stripped', () => {
  render(
    <ThinkingBlock
      thinking={'line one\n\n\nline two'}
      active={false}
      onPress={jest.fn()}
    />,
  );

  expect(mockStreamdown).toHaveBeenCalled();
  expect(mockStreamdown.mock.calls[0][0].markdown).toBe('line one\nline two');
});

test('calls onPress when tapped', () => {
  const onPress = jest.fn();
  const { getByRole } = render(
    <ThinkingBlock thinking="reasoning" active={false} onPress={onPress} />,
  );

  fireEvent.press(getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('matches the snapshot', () => {
  const { toJSON } = render(
    <ThinkingBlock thinking="reasoning" active={false} onPress={jest.fn()} />,
  );
  expect(toJSON()).toMatchSnapshot();
});
