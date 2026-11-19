import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { lightColors } from 'style';

import { FilterOption } from '../FilterOption';

const ICON = {
  iosIconName: 'speaker.wave.2',
  androidIconName: 'text_to_speech',
} as const;

const dotColor = (screen: Awaited<ReturnType<typeof render>>) => {
  const [dot] = screen.container.queryAll(
    node =>
      node.type === 'View' &&
      StyleSheet.flatten(node.props.style)?.borderRadius === 3,
  );
  return StyleSheet.flatten(dot.props.style).backgroundColor;
};

test('the selected option gets a primary dot and a bold label', async () => {
  const screen = await render(
    <FilterOption label="Text to Speech" selected onPress={jest.fn()} />,
  );

  expect(dotColor(screen)).toBe(lightColors.primary);
  const label = screen.getByText('Text to Speech');
  expect(label.props.bold).toBe(true);
  // No colour override: Text's own default, onSurface.
  expect(label.props.style).toBeUndefined();
});

test('an unselected option has no visible dot and a regular label', async () => {
  const screen = await render(
    <FilterOption
      label="Text to Speech"
      selected={false}
      onPress={jest.fn()}
    />,
  );

  expect(dotColor(screen)).toBeUndefined();
  const label = screen.getByText('Text to Speech');
  expect(label.props.bold).toBe(false);
  expect(label.props.style).toBeUndefined();
});

test('the icon uses the label colour', async () => {
  const screen = await render(
    <FilterOption
      label="Text to Speech"
      icon={ICON}
      selected={false}
      onPress={jest.fn()}
    />,
  );

  const [icon] = screen.container.queryAll(
    node => node.type === 'PlatformIcon',
  );
  expect(icon.props.color).toBe(lightColors.onSurface);
});

test('pressing the option calls onPress', async () => {
  const onPress = jest.fn();
  const screen = await render(
    <FilterOption label="All models" selected={false} onPress={onPress} />,
  );

  await fireEvent.press(screen.getByLabelText('All models'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
