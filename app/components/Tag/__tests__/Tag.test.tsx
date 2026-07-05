import React from 'react';
import { render } from '@testing-library/react-native';

import { Tag } from '../Tag';

describe('Tag', () => {
  test('renders a label without an icon', () => {
    const tree = render(<Tag label="Multilingual" />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders a label with an icon', () => {
    const tree = render(
      <Tag
        label="4B"
        iosIconName="square.stack.3d.up.fill"
        androidIconName="layers"
      />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders no icon when only one platform icon name is provided', () => {
    const tree = render(
      <Tag label="2.5 GB" iosIconName="internaldrive" />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('renders the High CPU usage label in yellow with a yellow background', () => {
    const tree = render(
      <Tag label="High CPU usage" iosIconName="cpu" androidIconName="memory" />,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
