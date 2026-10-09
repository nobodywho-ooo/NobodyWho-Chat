import React from 'react';
import { render } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';

import { InUseModels } from '../InUseModels';

test('renders correctly InUseModels', async () => {
  const screen = await render(
    <InUseModels models={[buildModel(1), buildModel(2)]} />,
  );
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders one selected card per model in use, under a single header', async () => {
  const models = [buildModel(1), buildModel(2)];
  const screen = await render(<InUseModels models={models} />);

  const cards = screen.container.queryAll(node => node.type === 'ModelCard');
  expect(cards.map(card => card.props.model)).toEqual(models);
  expect(cards.every(card => card.props.isSelected)).toBe(true);
  expect(screen.getAllByText('screens.models.inUse')).toHaveLength(1);
});
