import React from 'react';
import { render } from '@testing-library/react-native';

import { ListItem } from '../ListItem';

jest.unmock('../ListItem');

test('renders correctly ListItem', async () => {
  const tree = (
    await render(
      <ListItem
        title={'Some title'}
        subtitle={'Some subtitle'}
        iosIconName="bubble.fill"
        androidIconName="chat_bubble"
        iconColor="red"
      />,
    )
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly ListItem when disabled', async () => {
  const tree = (
    await render(
      <ListItem
        title={'Some title'}
        subtitle={'Some subtitle'}
        iosIconName="bubble.fill"
        androidIconName="chat_bubble"
        iconColor="red"
        disabled={true}
      />,
    )
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders without an icon when none is given', async () => {
  const screen = await render(
    <ListItem title={'Some title'} subtitle={'Some subtitle'} />,
  );

  expect(
    screen.container.queryAll(node => node.props.iosIconName !== undefined),
  ).toHaveLength(1); // the chevron only
});
