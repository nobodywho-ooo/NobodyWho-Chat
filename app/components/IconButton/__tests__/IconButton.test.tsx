import React from 'react';
import { render } from '@testing-library/react-native';

import { IconButton } from '../IconButton';

jest.unmock('../IconButton');

describe('IconButton', () => {
  test('renders with icon', () => {
    const tree = render(
      <IconButton icon={{ iosIconName: 'xmark', androidIconName: 'close' }} />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders with custom size', () => {
    const tree = render(
      <IconButton
        icon={{ iosIconName: 'gearshape', androidIconName: 'settings' }}
        size={24}
      />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
