import React from 'react';
import { render } from '@testing-library/react-native';

import { Button } from '../Button';

jest.unmock('../Button');

describe('Button', () => {
  test('renders primary variant', async () => {
    const tree = (
      await render(<Button title="Primary" variant="primary" />)
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders secondary variant', async () => {
    const tree = (
      await render(<Button title="Secondary" variant="secondary" />)
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders outline variant', async () => {
    const tree = (
      await render(<Button title="Outline" variant="outline" />)
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders with icon', async () => {
    const tree = (
      await render(
        <Button
          title="With Icon"
          icon={{ iosIconName: 'plus.bubble', androidIconName: 'add_comment' }}
        />,
      )
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders small', async () => {
    const tree = (await render(<Button title="Small" small />)).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
