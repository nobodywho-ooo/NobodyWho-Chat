import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render } from '@testing-library/react-native';

import { Toast } from '../Toast';

describe('Toast', () => {
  test('renders nothing while hidden', () => {
    const screen = render(<Toast visible={false} message="Loading Model 0…" />);

    expect(screen.queryByText('Loading Model 0…')).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  test('renders the message when visible', () => {
    const screen = render(<Toast visible message="Loading Model 0…" />);

    expect(screen.getByText('Loading Model 0…')).toBeTruthy();
    // No spinner unless the toast is reporting progress.
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
    expect(screen.toJSON()).toMatchSnapshot();
  });

  test('adds a spinner when loading', () => {
    const screen = render(<Toast visible loading message="Loading Model 0…" />);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  test('never takes touches away from what it covers', () => {
    const screen = render(<Toast visible message="Loading Model 0…" />);

    expect(screen.root.props.pointerEvents).toBe('none');
  });
});
