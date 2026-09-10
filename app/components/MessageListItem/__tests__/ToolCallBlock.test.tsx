import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import {
  ToolCallBlock,
  formatArguments,
} from '../AssistantMessage/ToolCallBlock';

describe('formatArguments', () => {
  test('formats arguments as a one-line summary', () => {
    expect(formatArguments({ city: 'Paris' })).toBe('city: "Paris"');
    expect(
      formatArguments({ value: 100, from: 'celsius', to: 'fahrenheit' }),
    ).toBe('value: 100, from: "celsius", to: "fahrenheit"');
  });

  test('is empty when there are no arguments', () => {
    expect(formatArguments({})).toBe('');
  });
});

describe('ToolCallBlock', () => {
  test('renders the tool name and an argument summary', () => {
    const { getByText } = render(
      <ToolCallBlock
        name="get_weather"
        arguments={{ city: 'Paris' }}
        onPress={jest.fn()}
      />,
    );

    expect(getByText('get_weather')).toBeTruthy();
    expect(getByText('city: "Paris"')).toBeTruthy();
  });

  test('omits the summary line when there are no arguments', () => {
    const { getByText, queryByText } = render(
      <ToolCallBlock name="get_time" arguments={{}} onPress={jest.fn()} />,
    );

    expect(getByText('get_time')).toBeTruthy();
    // No "key: value" summary is rendered.
    expect(queryByText(/: /)).toBeNull();
  });

  test('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <ToolCallBlock
        name="get_weather"
        arguments={{ city: 'Paris' }}
        onPress={onPress}
      />,
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('matches the snapshot', () => {
    const { toJSON } = render(
      <ToolCallBlock
        name="get_weather"
        arguments={{ city: 'Paris' }}
        onPress={jest.fn()}
      />,
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
