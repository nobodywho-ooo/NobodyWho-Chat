import React from 'react';
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
