import React from 'react';
import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { fireEvent, render } from '@testing-library/react-native';
import { useStyled } from 'hooks';
import { lightColors } from 'style';

import { ShimmerText } from '../ShimmerText';

jest.unmock('../ShimmerText');
jest.mock('hooks', () => ({
  ...jest.requireActual('hooks'),
  useStyled: jest.fn(),
}));

const mockUseReducedMotion = jest.mocked(useReducedMotion);
const mockUseStyled = jest.mocked(useStyled);

beforeEach(() => {
  mockUseStyled.mockReturnValue({ colors: lightColors });
});

afterEach(() => {
  mockUseReducedMotion.mockReturnValue(false);
});

type Screen = Awaited<ReturnType<typeof render>>;

// Reports the box's size the way the native layout pass would.
const layOut = (screen: Screen, width = 80) =>
  fireEvent(screen.root!, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 19 } },
  });

const textsOf = (screen: Screen) =>
  screen.container.queryAll(node => node.type === 'Text');

const colorOf = (node: ReturnType<typeof textsOf>[number]) =>
  StyleSheet.flatten(node.props.style).color;

const bandOf = (screen: Screen) =>
  screen.container.queryAll(node => node.type === 'LinearGradient')[0] ?? null;

test('renders correctly ShimmerText', async () => {
  const screen = await render(<ShimmerText text="Thinking…" />);
  await layOut(screen);

  expect(screen.toJSON()).toMatchSnapshot();
});

test('is real text, so screen readers announce it', async () => {
  const screen = await render(<ShimmerText text="Thinking…" />);

  expect(screen.getByText('Thinking…')).toBeTruthy();
});

test('stays announced as one label while sweeping', async () => {
  const screen = await render(<ShimmerText text="Thinking…" />);
  await layOut(screen);

  expect(screen.getByLabelText('Thinking…')).toBeTruthy();
});

test('draws the base colour, with no sweep, until the box is laid out', async () => {
  // The band's travel is unknown until layout.
  const screen = await render(<ShimmerText text="Thinking…" />);

  expect(textsOf(screen)).toHaveLength(1);
  expect(colorOf(textsOf(screen)[0])).toBe('#7c7c7c');
  expect(bandOf(screen)).toBeNull();
});

test('sweeps a highlight band through the text, masked to its glyphs', async () => {
  const screen = await render(<ShimmerText text="Thinking…" />);
  await layOut(screen);

  // The highlight colour, transparent at both ends of the band.
  expect(bandOf(screen)!.props.colors).toEqual([
    'rgba(0, 0, 0, 0)',
    '#000000',
    'rgba(0, 0, 0, 0)',
  ]);
});

test('keeps the text on a single line', async () => {
  const screen = await render(<ShimmerText text="Thinking really hard" />);
  await layOut(screen);

  textsOf(screen).forEach(node => expect(node.props.numberOfLines).toBe(1));
});

test('holds still in the base colour with reduced motion on', async () => {
  mockUseReducedMotion.mockReturnValue(true);
  const screen = await render(<ShimmerText text="Thinking…" />);
  await layOut(screen);

  expect(textsOf(screen)).toHaveLength(1);
  expect(colorOf(textsOf(screen)[0])).toBe('#7c7c7c');
  expect(bandOf(screen)).toBeNull();
});
