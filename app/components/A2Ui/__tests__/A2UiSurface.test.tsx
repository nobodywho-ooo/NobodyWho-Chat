import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { haptics } from 'helpers';

import { A2UiSurface } from '../A2UiSurface';

// A surface exercising bindings, nesting and an interactive control, so the
// snapshot covers the renderer's main paths. Components nest by value — no ids.
const surface: Parameters<typeof A2UiSurface>[0]['surface'] = {
  components: [
    {
      component: 'Card',
      child: { component: 'Text', text: { '@path': '/message' }, variant: 'body' },
    },
    {
      component: 'Button',
      child: { component: 'Text', text: 'Flip it' },
      variant: 'primary',
      action: { event: { name: 'flip', context: {} } },
    },
  ],
  dataModel: { message: 'Hello, Ada' },
};

test('renders a binding-driven surface', async () => {
  const { toJSON } = await render(<A2UiSurface surface={surface} />);
  expect(toJSON()).toMatchSnapshot();
});

test('renders the data-model value', async () => {
  const { getByText } = await render(<A2UiSurface surface={surface} />);
  expect(getByText('Hello, Ada')).toBeTruthy();
});

test('a button press dispatches its event with a haptic', async () => {
  const medium = jest.spyOn(haptics, 'medium').mockImplementation(() => {});
  try {
    const { getByRole } = await render(<A2UiSurface surface={surface} />);
    fireEvent.press(getByRole('button'));
    expect(medium).toHaveBeenCalled();
  } finally {
    medium.mockRestore();
  }
});