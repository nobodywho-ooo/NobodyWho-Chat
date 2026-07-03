import React from 'react';
import { render } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';

import { InUseModel } from '../InUseModel';

test('renders correctly InUseModel', () => {
  const screen = render(<InUseModel title="header" model={buildModel(1)} />);
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders the model card as selected', () => {
  const model = buildModel(1);
  const screen = render(<InUseModel title="header" model={model} />);

  const card = screen.UNSAFE_getByType('ModelCard' as never);
  expect(card.props.model).toBe(model);
  expect(card.props.isSelected).toBe(true);
});
