import React from 'react';
import { Modal } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { ToolCallModal } from '../ToolCallModal';

const baseProps = {
  name: 'get_weather',
  arguments: { city: 'Paris' },
  result: '{"temperatureCelsius":12}',
};

test('renders the tool name, arguments and result when visible', () => {
  const { getByText } = render(
    <ToolCallModal {...baseProps} visible onClose={jest.fn()} />,
  );

  expect(getByText('get_weather')).toBeTruthy();
  expect(getByText('components.messageListItem.toolArguments')).toBeTruthy();
  expect(getByText('components.messageListItem.toolResult')).toBeTruthy();
  expect(getByText(/"city": "Paris"/)).toBeTruthy();
  expect(getByText('{"temperatureCelsius":12}')).toBeTruthy();
});

test('calls onClose when the close button is pressed', () => {
  const onClose = jest.fn();
  const { getByLabelText } = render(
    <ToolCallModal {...baseProps} visible onClose={onClose} />,
  );

  fireEvent.press(getByLabelText('components.messageListItem.closeToolCalls'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('is hidden when visible is false', () => {
  const { UNSAFE_getByType } = render(
    <ToolCallModal {...baseProps} visible={false} onClose={jest.fn()} />,
  );

  expect(UNSAFE_getByType(Modal).props.visible).toBe(false);
});

test('matches the snapshot when visible', () => {
  const { toJSON } = render(
    <ToolCallModal {...baseProps} visible onClose={jest.fn()} />,
  );
  expect(toJSON()).toMatchSnapshot();
});
