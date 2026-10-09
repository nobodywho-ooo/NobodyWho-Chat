import React from 'react';
import { render } from '@testing-library/react-native';

import { Waveform } from '../UserMessage/Waveform';

test('renders an svg with one bar per sample, all in the given color', async () => {
  const { container } = await render(<Waveform color="#abcdef" />);

  expect(container.queryAll(node => node.type === 'Svg')).toHaveLength(1);

  const bars = container.queryAll(node => node.type === 'Rect');
  expect(bars).toHaveLength(18);
  bars.forEach(bar => expect(bar.props.fill).toBe('#abcdef'));
});

test('sizes the svg to the requested height', async () => {
  const { root } = await render(<Waveform color="#000" height={40} />);

  expect(root?.type).toBe('Svg');
  expect(root?.props.height).toBe(40);
});

test('matches the snapshot', async () => {
  const { toJSON } = await render(<Waveform color="#abcdef" />);
  expect(toJSON()).toMatchSnapshot();
});
