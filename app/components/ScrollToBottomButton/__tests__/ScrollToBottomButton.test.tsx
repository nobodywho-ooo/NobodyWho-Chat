import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ScrollToBottomButton } from '../ScrollToBottomButton';

describe('ScrollToBottomButton', () => {
  test('renders nothing while hidden', () => {
    const screen = render(
      <ScrollToBottomButton visible={false} onPress={jest.fn()} />,
    );

    expect(screen.toJSON()).toBeNull();
  });

  test('renders a chevron when visible', () => {
    const screen = render(<ScrollToBottomButton visible onPress={jest.fn()} />);

    expect(
      screen.getByLabelText('components.scrollToBottomButton.label'),
    ).toBeTruthy();
    expect(screen.toJSON()).toMatchSnapshot();
  });

  test('reports presses', () => {
    const onPress = jest.fn();
    const screen = render(<ScrollToBottomButton visible onPress={onPress} />);

    fireEvent.press(
      screen.getByLabelText('components.scrollToBottomButton.label'),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('only takes touches on the chevron itself', () => {
    // It floats over the conversation, so everything around the button has to
    // stay scrollable.
    const screen = render(<ScrollToBottomButton visible onPress={jest.fn()} />);

    expect(screen.root.props.pointerEvents).toBe('box-none');
  });
});
