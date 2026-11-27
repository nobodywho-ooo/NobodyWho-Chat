import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { lightColors } from 'style';

import { FilterOption } from '../FilterOption';

const ICON = {
  iosIconName: 'speaker.wave.2',
  androidIconName: 'text_to_speech',
} as const;

const iconColor = (screen: Awaited<ReturnType<typeof render>>) => {
  const [icon] = screen.container.queryAll(
    node => node.type === 'PlatformIcon',
  );
  return icon.props.color;
};

const hasDot = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.container.queryAll(
    node =>
      node.type === 'View' &&
      StyleSheet.flatten(node.props.style)?.borderRadius === 3,
  ).length > 0;

test('the selected option has a bold label and icon in the primary colour, no dot', async () => {
  const screen = await render(
    <FilterOption
      label="Text to Speech"
      icon={ICON}
      selected
      onPress={jest.fn()}
    />,
  );

  expect(hasDot(screen)).toBe(false);
  expect(iconColor(screen)).toBe(lightColors.primary);
  const label = screen.getByText('Text to Speech');
  expect(label.props.bold).toBe(true);
  expect(label.props.style).toEqual({ color: lightColors.primary });
});

test('an unselected option has a regular label and icon in the text colour', async () => {
  const screen = await render(
    <FilterOption
      label="Text to Speech"
      icon={ICON}
      selected={false}
      onPress={jest.fn()}
    />,
  );

  expect(hasDot(screen)).toBe(false);
  expect(iconColor(screen)).toBe(lightColors.onSurface);
  const label = screen.getByText('Text to Speech');
  expect(label.props.bold).toBe(false);
  expect(label.props.style).toBeUndefined();
});

test('pressing the option calls onPress', async () => {
  const onPress = jest.fn();
  const screen = await render(
    <FilterOption
      label="All models"
      icon={ICON}
      selected={false}
      onPress={onPress}
    />,
  );

  await fireEvent.press(screen.getByLabelText('All models'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
