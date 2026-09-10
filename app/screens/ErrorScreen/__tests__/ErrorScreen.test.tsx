import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { ErrorScreen } from '../ErrorScreen';

test('renders correctly ErrorScreen', () => {
  const tree = render(<ErrorScreen onRetry={() => {}} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('hides the reset action when no onReset handler is given', () => {
  const { queryByTestId } = render(<ErrorScreen onRetry={() => {}} />);
  expect(queryByTestId('error-reset-button')).toBeNull();
});

test('confirms before resetting and only resets on confirmation', () => {
  const onReset = jest.fn();
  const alertSpy = jest.spyOn(Alert, 'alert');

  const { getByTestId } = render(
    <ErrorScreen onRetry={() => {}} onReset={onReset} />,
  );

  fireEvent.press(getByTestId('error-reset-button'));

  // The reset is gated behind a confirmation dialog, not fired immediately.
  expect(alertSpy).toHaveBeenCalledTimes(1);
  expect(onReset).not.toHaveBeenCalled();

  // Invoke the destructive button's handler from the alert's button list.
  const buttons = alertSpy.mock.calls[0][2] as { onPress?: () => void }[];
  buttons[buttons.length - 1].onPress?.();
  expect(onReset).toHaveBeenCalledTimes(1);

  alertSpy.mockRestore();
});
