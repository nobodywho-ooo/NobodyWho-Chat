import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { SelectablePill } from '../SelectablePill';

describe('SelectablePill', () => {
  test('renders an unselected pill', async () => {
    const tree = (
      await render(
        <SelectablePill label="Male 1" selected={false} onPress={jest.fn()} />,
      )
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders a selected pill', async () => {
    const tree = (
      await render(
        <SelectablePill label="Male 1" selected onPress={jest.fn()} />,
      )
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders a pill with an icon', async () => {
    const tree = (
      await render(
        <SelectablePill
          label="Text to Speech"
          icon={{
            iosIconName: 'speaker.wave.2',
            androidIconName: 'text_to_speech',
          }}
          selected={false}
          onPress={jest.fn()}
        />,
      )
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('shows no icon unless one is given', async () => {
    const withoutIcon = await render(
      <SelectablePill label="Male 1" selected={false} onPress={jest.fn()} />,
    );
    expect(
      withoutIcon.container.queryAll(node => node.type === 'PlatformIcon'),
    ).toHaveLength(0);

    const withIcon = await render(
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
    expect(
      withIcon.container.queryAll(node => node.type === 'PlatformIcon'),
    ).toHaveLength(1);
  });

  test('the icon takes the label colour and size', async () => {
    const { container, getByText } = await render(
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

    const [icon] = container.queryAll(node => node.type === 'PlatformIcon');
    expect(icon.props.size).toBe(11);
    // Same colour the selected label uses, so the two read as one unit.
    expect(icon.props.color).toBe(
      StyleSheet.flatten(getByText('Text to Speech').props.style).color,
    );
  });

  test('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(
      <SelectablePill label="English" selected={false} onPress={onPress} />,
    );

    await fireEvent.press(getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('is labelled by its text and exposes the selected state', async () => {
    const { getByRole } = await render(
      <SelectablePill label="English" selected onPress={jest.fn()} />,
    );

    const pill = getByRole('button');
    expect(pill.props.accessibilityLabel).toBe('English');
    expect(pill.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });
});
