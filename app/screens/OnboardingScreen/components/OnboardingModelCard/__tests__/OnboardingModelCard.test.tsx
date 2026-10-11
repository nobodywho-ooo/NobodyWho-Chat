import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';

import { OnboardingModelCard } from '../OnboardingModelCard';

test('shows the name with its parameters, the size, then languages and thinking', async () => {
  const model = buildModel(1, {
    name: 'LFM2.5',
    parameterCountBillions: 2.6,
    sizeGB: 4,
    thinking: true,
    languages: ['en', 'da'],
    tags: ['Recommended', 'Great First Pick', 'Agentic capabilities'],
  });
  await render(<OnboardingModelCard model={model} onPress={jest.fn()} />);

  screen.getByText('LFM2.5');
  screen.getByText('(2.6B)');
  screen.getByText('4 GB');
  expect(
    screen.container.queryAll(
      node =>
        node.type === 'PlatformIcon' &&
        node.props.iosIconName === 'internaldrive',
    ),
  ).toHaveLength(1);
  screen.getByText('components.modelCard.languageCount');
  screen.getByText('components.modelCard.thinking');
  // No other tag: catalogue tags nor the heavy processing warning.
  expect(screen.queryByText('Recommended')).toBeNull();
  expect(screen.queryByText('Great First Pick')).toBeNull();
  expect(screen.queryByText('Agentic capabilities')).toBeNull();
  expect(screen.queryByText('components.modelCard.heavyProcessing')).toBeNull();
});

test('leaves out what the model does not have', async () => {
  const model = buildModel(1, { parameterCountBillions: 0, sizeGB: 0.5 });
  await render(<OnboardingModelCard model={model} onPress={jest.fn()} />);

  screen.getByText('512 MB');
  expect(screen.queryByText(/B\)$/)).toBeNull();
  expect(screen.queryByText('components.modelCard.languageCount')).toBeNull();
  expect(screen.queryByText('components.modelCard.thinking')).toBeNull();
});

test('hands its model to onPress', async () => {
  const model = buildModel(1);
  const onPress = jest.fn();
  await render(<OnboardingModelCard model={model} onPress={onPress} />);

  await fireEvent.press(screen.getByLabelText(model.name));

  expect(onPress).toHaveBeenCalledWith(model);
});
