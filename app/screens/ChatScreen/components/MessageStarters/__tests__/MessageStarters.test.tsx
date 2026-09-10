import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ModelPipeline } from 'types';

import { MessageStarters } from '../MessageStarters';

// The starter selection is random; pin it to a single known starter.
jest.mock('../starters', () => ({
  pickStarterIds: () => ['planParisTrip'],
}));

describe('MessageStarters', () => {
  test('selecting a starter reports its body', () => {
    const onSelect = jest.fn();
    const screen = render(
      <MessageStarters
        pipeline={ModelPipeline.textGeneration}
        onSelect={onSelect}
      />,
    );

    fireEvent.press(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith(
      'components.messageStarters.planParisTrip.body',
    );
  });

  test('disabled keeps the starters listed but unselectable', () => {
    const onSelect = jest.fn();
    const screen = render(
      <MessageStarters
        pipeline={ModelPipeline.textGeneration}
        onSelect={onSelect}
        disabled
      />,
    );

    // Disabling changes nothing about what is offered, only what a press does.
    const starter = screen.getByRole('button');
    expect(
      screen.getByText('components.messageStarters.planParisTrip.title'),
    ).toBeTruthy();

    fireEvent.press(starter);

    expect(onSelect).not.toHaveBeenCalled();
  });
});
