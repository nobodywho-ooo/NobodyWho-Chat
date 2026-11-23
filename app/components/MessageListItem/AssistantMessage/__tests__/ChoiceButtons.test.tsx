import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ChoiceButtons } from '../ChoiceButtons';

describe('ChoiceButtons', () => {
  test('renders one button per choice', async () => {
    const view = await render(
      <ChoiceButtons
        choices={['Walk', 'Bus', 'Bike']}
        onSendText={jest.fn()}
      />,
    );

    expect(view.getByText('Walk')).toBeTruthy();
    expect(view.getByText('Bus')).toBeTruthy();
    expect(view.getByText('Bike')).toBeTruthy();
  });

  test('tapping a choice sends its text', async () => {
    const onSendText = jest.fn();
    const view = await render(
      <ChoiceButtons
        choices={['Walk', 'Bus']}
        onSendText={onSendText}
      />,
    );

    await fireEvent.press(view.getByText('Bus'));

    expect(onSendText).toHaveBeenCalledTimes(1);
    expect(onSendText).toHaveBeenCalledWith('Bus');
  });
});
