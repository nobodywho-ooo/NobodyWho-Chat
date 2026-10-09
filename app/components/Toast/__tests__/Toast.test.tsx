import React from 'react';
import { render } from '@testing-library/react-native';

import { Toast } from '../Toast';

describe('Toast', () => {
  test('renders nothing while hidden', async () => {
    const screen = await render(
      <Toast visible={false} message="Loading Model 0…" />,
    );

    expect(screen.queryByText('Loading Model 0…')).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  test('renders the message when visible', async () => {
    const screen = await render(<Toast visible message="Loading Model 0…" />);

    expect(screen.getByText('Loading Model 0…')).toBeTruthy();
    // No spinner unless the toast is reporting progress.
    expect(
      screen.container.queryAll(node => node.type === 'ActivityIndicator'),
    ).toHaveLength(0);
    expect(screen.toJSON()).toMatchSnapshot();
  });

  test('adds a spinner when loading', async () => {
    const screen = await render(
      <Toast visible loading message="Loading Model 0…" />,
    );

    expect(
      screen.container.queryAll(node => node.type === 'ActivityIndicator'),
    ).toHaveLength(1);
  });

  test('never takes touches away from what it covers', async () => {
    const screen = await render(<Toast visible message="Loading Model 0…" />);

    expect(screen.root?.props.pointerEvents).toBe('none');
  });
});
