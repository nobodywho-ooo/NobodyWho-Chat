import React from 'react';
import { render } from '@testing-library/react-native';

import { ListItem } from '../ListItem';

jest.unmock('../ListItem');

test('renders correctly ListItem', () => {
  const tree = render(
    <ListItem
      title={'Some title'}
      subtitle={'Some subtitle'}
      iosIconName="bubble.fill"
      androidIconName="chat_bubble"
      iconBackgroundColor="red"
    />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly ListItem when disabled', () => {
  const tree = render(
    <ListItem
      title={'Some title'}
      subtitle={'Some subtitle'}
      iosIconName="bubble.fill"
      androidIconName="chat_bubble"
      iconBackgroundColor="red"
      disabled={true}
    />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});
