import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { SelectablePill } from '../SelectablePill';

describe('SelectablePill', () => {
  test('renders an unselected pill', () => {
    const tree = render(
      <SelectablePill label="Male 1" selected={false} onPress={jest.fn()} />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders a selected pill', () => {
    const tree = render(
      <SelectablePill label="Male 1" selected onPress={jest.fn()} />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders a pill with an icon', () => {
    const tree = render(
      <SelectablePill
        label="Text to Speech"
        icon={{
          iosIconName: 'speaker.wave.2',
          androidIconName: 'text_to_speech',
        }}
        selected={false}
        onPress={jest.fn()}
      />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('shows no icon unless one is given', () => {
    const withoutIcon = render(
      <SelectablePill label="Male 1" selected={false} onPress={jest.fn()} />,
    );
    expect(
      withoutIcon.UNSAFE_queryAllByType('PlatformIcon' as never),
    ).toHaveLength(0);

    const withIcon = render(
      <SelectablePill
        label="Text to Speech"
        icon={{
          iosIconName: 'speaker.wave.2',
          androidIconName: 'text_to_speech',
        }}
        selected={false}
        onPress={jest.fn()}
      />,
    );
    expect(withIcon.UNSAFE_getAllByType('PlatformIcon' as never)).toHaveLength(
      1,
    );
  });

  test('the icon takes the label colour and size', () => {
    const { UNSAFE_getByType, getByText } = render(
      <SelectablePill
        label="Text to Speech"
        icon={{
          iosIconName: 'speaker.wave.2',
          androidIconName: 'text_to_speech',
        }}
        iconSize={11}
        selected
        onPress={jest.fn()}
      />,
    );

    const icon = UNSAFE_getByType('PlatformIcon' as never);
    expect(icon.props.size).toBe(11);
    // Same colour the selected label uses, so the two read as one unit.
    expect(icon.props.color).toBe(
      StyleSheet.flatten(getByText('Text to Speech').props.style).color,
    );
  });

  test('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <SelectablePill label="English" selected={false} onPress={onPress} />,
    );

    fireEvent.press(getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('is labelled by its text and exposes the selected state', () => {
    const { getByRole } = render(
      <SelectablePill label="English" selected onPress={jest.fn()} />,
    );

    const pill = getByRole('button');
    expect(pill.props.accessibilityLabel).toBe('English');
    expect(pill.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });
});
