import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ScrollToBottomButton } from '../ScrollToBottomButton';

describe('ScrollToBottomButton', () => {
  test('renders nothing while hidden', async () => {
    const screen = await render(
      <ScrollToBottomButton visible={false} onPress={jest.fn()} />,
    );

    expect(screen.toJSON()).toBeNull();
  });

  test('renders a chevron when visible', async () => {
    const screen = await render(
      <ScrollToBottomButton visible onPress={jest.fn()} />,
    );

    expect(
      screen.getByLabelText('components.scrollToBottomButton.label'),
    ).toBeTruthy();
    expect(screen.toJSON()).toMatchSnapshot();
  });

  test('reports presses', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <ScrollToBottomButton visible onPress={onPress} />,
    );

    await fireEvent.press(
      screen.getByLabelText('components.scrollToBottomButton.label'),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('only takes touches on the chevron itself', async () => {
    // It floats over the conversation, so everything around the button has to
    // stay scrollable.
    const screen = await render(
      <ScrollToBottomButton visible onPress={jest.fn()} />,
    );

    expect(screen.root?.props.pointerEvents).toBe('box-none');
  });
});
