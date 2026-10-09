import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ActionButton } from '../ActionButton';

describe('ActionButton', () => {
  test('renders the icon and label', async () => {
    const tree = (
      await render(
        <ActionButton
          icon={{ iosIconName: 'gearshape', androidIconName: 'settings' }}
          label="Settings"
          onPress={() => {}}
        />,
      )
    ).toJSON();

    expect(tree).toMatchSnapshot();
  });

  test('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <ActionButton
        icon={{ iosIconName: 'gearshape', androidIconName: 'settings' }}
        label="Settings"
        onPress={onPress}
      />,
    );

    await fireEvent.press(screen.getByText('Settings'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
