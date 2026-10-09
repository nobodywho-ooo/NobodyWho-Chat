import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { Slider } from '../Slider';

const layoutTrack = async (
  screen: Awaited<ReturnType<typeof render>>,
  width = 200,
) => {
  const slider = screen.getByRole('adjustable');
  await fireEvent(slider, 'layout', { nativeEvent: { layout: { width } } });
  return slider;
};

test('renders correctly Slider', async () => {
  const screen = await render(
    <Slider value={0.8} minimumValue={0} maximumValue={2} step={0.1} />,
  );
  await layoutTrack(screen);

  expect(screen.toJSON()).toMatchSnapshot();
});

test('exposes its range and value for accessibility', async () => {
  const screen = await render(
    <Slider value={0.8} minimumValue={0} maximumValue={2} step={0.1} />,
  );

  expect(screen.getByRole('adjustable').props.accessibilityValue).toEqual({
    min: 0,
    max: 2,
    now: 0.8,
  });
});

test('grabbing the thumb does not jump the value', async () => {
  const onValueChange = jest.fn();
  const screen = await render(
    <Slider
      value={1}
      minimumValue={0}
      maximumValue={2}
      step={0.1}
      onValueChange={onValueChange}
    />,
  );
  const slider = await layoutTrack(screen);

  // A grant (touch down) starts the drag from the thumb's current position and
  // must not report a new value on its own — no snap to 0.
  await fireEvent(slider, 'responderGrant', {
    nativeEvent: { locationX: 5, touches: [], changedTouches: [] },
    touchHistory: { touchBank: [], mostRecentTimeStamp: 1 },
  });

  expect(onValueChange).not.toHaveBeenCalled();
});
