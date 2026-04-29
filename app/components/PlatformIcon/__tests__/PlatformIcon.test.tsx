import React from 'react';
import { render } from '@testing-library/react-native';

import { PlatformIcon } from '../PlatformIcon';

jest.unmock('../PlatformIcon');

test('renders correctly PlatformIcon', () => {
  const tree = render(
    <PlatformIcon
      iosIconName="bubble.fill"
      androidIconName="chat_bubble"
      size={48}
      color={'red'}
    />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});
