import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { GradientText } from '../GradientText';

const characterColors = () =>
  screen.container
    .queryAll(
      node =>
        typeof node.props.children === 'string' &&
        node.props.children.length === 1,
    )
    .map(node => [node.props.children, node.props.style.color]);

test('reads as the whole text', async () => {
  await render(
    <GradientText from="#000000" to="#ffffff">
      abc
    </GradientText>,
  );

  screen.getByText('abc');
});

test('runs each character from the first colour to the last', async () => {
  await render(
    <GradientText from="#000000" to="#ffffff">
      abc
    </GradientText>,
  );

  expect(characterColors()).toEqual([
    ['a', 'rgba(0, 0, 0, 1)'],
    ['b', 'rgba(128, 128, 128, 1)'],
    ['c', 'rgba(255, 255, 255, 1)'],
  ]);
});

test('gives a single character the first colour', async () => {
  await render(
    <GradientText from="#000000" to="#ffffff">
      a
    </GradientText>,
  );

  expect(characterColors()).toEqual([['a', 'rgba(0, 0, 0, 1)']]);
});
