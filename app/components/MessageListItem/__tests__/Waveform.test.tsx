import React from 'react';
import { render } from '@testing-library/react-native';
import { Rect, Svg } from 'react-native-svg';

import { Waveform } from '../Waveform';

test('renders an svg with one bar per sample, all in the given color', () => {
  const { UNSAFE_getByType, UNSAFE_getAllByType } = render(
    <Waveform color="#abcdef" />,
  );

  expect(UNSAFE_getByType(Svg)).toBeTruthy();

  const bars = UNSAFE_getAllByType(Rect);
  expect(bars).toHaveLength(18);
  bars.forEach(bar => expect(bar.props.fill).toBe('#abcdef'));
});

test('sizes the svg to the requested height', () => {
  const { UNSAFE_getByType } = render(<Waveform color="#000" height={40} />);

  expect(UNSAFE_getByType(Svg).props.height).toBe(40);
});

test('matches the snapshot', () => {
  const { toJSON } = render(<Waveform color="#abcdef" />);
  expect(toJSON()).toMatchSnapshot();
});
