import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ToolCallModal } from '../AssistantMessage/ToolCallModal';

const baseProps = {
  name: 'get_weather',
  arguments: { city: 'Paris' },
  result: '{"temperatureCelsius":12}',
};

test('renders the tool name, arguments and result when visible', async () => {
  const { getByText } = await render(
    <ToolCallModal {...baseProps} visible onClose={jest.fn()} />,
  );

  expect(getByText('get_weather')).toBeTruthy();
  expect(getByText('components.messageListItem.toolArguments')).toBeTruthy();
  expect(getByText('components.messageListItem.toolResult')).toBeTruthy();
  expect(getByText(/"city": "Paris"/)).toBeTruthy();
  expect(getByText('{"temperatureCelsius":12}')).toBeTruthy();
});

test('calls onClose when the close button is pressed', async () => {
  const onClose = jest.fn();
  const { getByLabelText } = await render(
    <ToolCallModal {...baseProps} visible onClose={onClose} />,
  );

  await fireEvent.press(
    getByLabelText('components.messageListItem.closeToolCalls'),
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('is hidden when visible is false', async () => {
  const { queryByLabelText, queryByText } = await render(
    <ToolCallModal {...baseProps} visible={false} onClose={jest.fn()} />,
  );

  expect(queryByText('get_weather')).toBeNull();
  expect(
    queryByLabelText('components.messageListItem.closeToolCalls'),
  ).toBeNull();
});

test('matches the snapshot when visible', async () => {
  const { toJSON } = await render(
    <ToolCallModal {...baseProps} visible onClose={jest.fn()} />,
  );
  expect(toJSON()).toMatchSnapshot();
});
