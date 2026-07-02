import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { Slider } from '../Slider';

const layoutTrack = (screen: ReturnType<typeof render>, width = 200) => {
  const slider = screen.getByRole('adjustable');
  fireEvent(slider, 'layout', { nativeEvent: { layout: { width } } });
  return slider;
};

test('renders correctly Slider', () => {
  const screen = render(
    <Slider value={0.8} minimumValue={0} maximumValue={2} step={0.1} />,
  );
  layoutTrack(screen);

  expect(screen.toJSON()).toMatchSnapshot();
});

test('exposes its range and value for accessibility', () => {
  const screen = render(
    <Slider value={0.8} minimumValue={0} maximumValue={2} step={0.1} />,
  );

  expect(screen.getByRole('adjustable').props.accessibilityValue).toEqual({
    min: 0,
    max: 2,
    now: 0.8,
  });
});

test('grabbing the thumb does not jump the value', () => {
  const onValueChange = jest.fn();
  const screen = render(
    <Slider
      value={1}
      minimumValue={0}
      maximumValue={2}
      step={0.1}
      onValueChange={onValueChange}
    />,
  );
  const slider = layoutTrack(screen);

  // A grant (touch down) starts the drag from the thumb's current position and
  // must not report a new value on its own — no snap to 0.
  fireEvent(slider, 'responderGrant', {
    nativeEvent: { locationX: 5, touches: [], changedTouches: [] },
    touchHistory: { touchBank: [], mostRecentTimeStamp: 1 },
  });

  expect(onValueChange).not.toHaveBeenCalled();
});
