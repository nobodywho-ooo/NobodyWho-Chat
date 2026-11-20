import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { haptics } from 'helpers';

import { A2UiSurface } from '../A2UiSurface';
import type { A2UiSurface as A2UiSurfaceData } from '../../../services/a2ui/types';

// A surface exercising bindings, nesting and an interactive control, so the
// snapshot covers the renderer's main paths. Text/PlatformIcon are mocked to
// string components (jest/mock/components), the rest renders as RN host views.
const surface = {
  components: [
    { component: 'Column', id: 'root', children: ['card', 'toggle'] },
    {
      component: 'Card',
      id: 'card',
      child: 'greeting',
    },
    { component: 'Text', id: 'greeting', text: { '@path': '/message' }, variant: 'body' },
    {
      component: 'Button',
      id: 'toggle',
      child: 'toggleLabel',
      variant: 'primary',
      action: { event: { name: 'flip', context: { on: true } } },
    },
    { component: 'Text', id: 'toggleLabel', text: 'Flip it' },
  ],
  dataModel: { message: 'Hello, Ada' },
} as A2UiSurfaceData;

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
