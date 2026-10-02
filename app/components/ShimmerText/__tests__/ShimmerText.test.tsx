import React from 'react';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { fireEvent, render } from '@testing-library/react-native';

import { ShimmerText } from '../ShimmerText';

jest.unmock('../ShimmerText');

const mockUseReducedMotion = jest.mocked(useReducedMotion);

afterEach(() => {
  mockUseReducedMotion.mockReturnValue(false);
});

type Screen = ReturnType<typeof render>;

// Reports the box's size the way the native layout pass would.
const layOut = (screen: Screen, width = 80) =>
  fireEvent(screen.root, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 19 } },
  });

const veilOf = (screen: Screen) =>
  screen.UNSAFE_queryByType('LinearGradient' as never);

const textOf = (screen: Screen) => screen.UNSAFE_getByType(Text);

const colorOf = (screen: Screen) => textOf(screen).props.style.color;

// The opacity in a veil colour like rgba(255, 255, 255, 0.4863).
const alphaOf = (rgba: string) => Number(rgba.split(',')[3].replace(')', ''));

test('renders correctly ShimmerText', () => {
  const screen = render(<ShimmerText text="Thinking…" />);
  layOut(screen);

  expect(screen.toJSON()).toMatchSnapshot();
});

test('is real text, so screen readers announce it', () => {
  const screen = render(<ShimmerText text="Thinking…" />);

  expect(screen.getByText('Thinking…')).toBeTruthy();
});

test('draws the base colour, with no sweep, until the box is laid out', () => {
  // Without a width the band's travel is unknown until layout. Drawing the
  // highlight before the veil is up would flash it for a frame.
  const screen = render(<ShimmerText text="Thinking…" />);

  expect(colorOf(screen)).toBe('#7c7c7c');
  expect(veilOf(screen)).toBeNull();
});

test('sweeps a veil of the background over the highlighted text', () => {
  const screen = render(<ShimmerText text="Thinking…" />);
  layOut(screen);

  expect(colorOf(screen)).toBe('#000000');
  const colors = veilOf(screen)!.props.colors as string[];
  // Solid veil either side of the band, with a gap in its middle.
  expect(colors[0]).toMatch(/^rgba\(255, 255, 255, /);
  expect(colors[2]).toBe('rgba(255, 255, 255, 0)');
});

test.each([
  ['light', '#000000', '#7c7c7c', '#FFFFFF', 0x7c],
  ['dark', '#FFFFFF', '#d8d8d8', '#121212', 0xd8],
])(
  'outside the band the %s highlight reads as exactly the base colour',
  (_theme, highlight, base, background, baseChannel) => {
    const screen = render(
      <ShimmerText
        text="Thinking…"
        highlightColor={highlight}
        baseColor={base}
        backgroundColor={background}
      />,
    );
    layOut(screen);

    const alpha = alphaOf(veilOf(screen)!.props.colors[0]);
    const h = parseInt(highlight.slice(1, 3), 16);
    const d = parseInt(background.slice(1, 3), 16);
    expect(Math.round(h + (d - h) * alpha)).toBe(baseChannel);
  },
);

test('keeps the text on a single line when no width is given', () => {
  const screen = render(<ShimmerText text="Thinking really hard" />);

  expect(textOf(screen).props.numberOfLines).toBe(1);
});

test('wraps within a given width, sweeping straight away', () => {
  const screen = render(
    <ShimmerText text="one two three" width={40} fontSize={16} />,
  );

  expect(textOf(screen).props.numberOfLines).toBe(3);
  expect(veilOf(screen)).not.toBeNull();
});

test('truncates once maxLines is reached', () => {
  const screen = render(
    <ShimmerText text="one two three" width={40} fontSize={16} maxLines={2} />,
  );

  expect(textOf(screen).props.numberOfLines).toBe(2);
});

test('holds still in the base colour with reduced motion on', () => {
  mockUseReducedMotion.mockReturnValue(true);
  const screen = render(<ShimmerText text="Thinking…" />);
  layOut(screen);

  expect(colorOf(screen)).toBe('#7c7c7c');
  expect(veilOf(screen)).toBeNull();
});

test('falls back to the base colour on a background it cannot veil with', () => {
  const screen = render(
    <ShimmerText text="Thinking…" backgroundColor="transparent" />,
  );
  layOut(screen);

  expect(colorOf(screen)).toBe('#7c7c7c');
  expect(veilOf(screen)).toBeNull();
});
