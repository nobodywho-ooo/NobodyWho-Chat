import React from 'react';
import { render } from '@testing-library/react-native';

import { ShimmerText } from '../ShimmerText';

jest.unmock('../ShimmerText');

const textsOf = (screen: ReturnType<typeof render>) =>
  screen
    .UNSAFE_getAllByType('SkiaText' as never)
    .map(node => node.props.text as string);

test('renders correctly ShimmerText', () => {
  const tree = render(<ShimmerText text="Thinking…" />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('keeps the text on a single line when no width is given', () => {
  const screen = render(<ShimmerText text="Thinking really hard" />);
  expect(textsOf(screen)).toEqual(['Thinking really hard']);
});

test('wraps onto several lines within the given width', () => {
  // The mocked font measures half an em per character, so 40px fits 5 chars.
  const screen = render(
    <ShimmerText text="one two three" width={40} fontSize={16} />,
  );
  expect(textsOf(screen)).toEqual(['one', 'two', 'three']);
});

test('truncates the last line once maxLines is reached', () => {
  const screen = render(
    <ShimmerText text="one two three" width={40} fontSize={16} maxLines={2} />,
  );
  expect(textsOf(screen)).toEqual(['one', 'two…']);
});

// --- Stable geometry -------------------------------------------------------

const baselineOf = (screen: ReturnType<typeof render>) =>
  screen.UNSAFE_getAllByType('SkiaText' as never)[0].props.y as number;

test('lays out without Skia font metrics', () => {
  // Metrics come back zeroed until the typeface resolves (see the Skia mock).
  // Sizing the canvas from them would render it collapsed and then grow it a
  // frame later, shoving whatever sits next to it around the screen.
  const screen = render(<ShimmerText text="Thinking…" fontSize={14} />);

  expect(baselineOf(screen)).toBeGreaterThan(0);
});

test('keeps the same geometry across re-renders', () => {
  const screen = render(<ShimmerText text="Thinking…" fontSize={14} />);
  const first = baselineOf(screen);

  screen.update(<ShimmerText text="Thinking…" fontSize={14} />);

  expect(baselineOf(screen)).toBe(first);
});
